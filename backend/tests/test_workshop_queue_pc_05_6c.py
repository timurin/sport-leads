"""Real Demand/scheduler queue scenarios; isolated data and no live network."""
from datetime import timedelta

import pytest
from sqlalchemy import event, select

from tests.test_production_scheduler_pc_04_3a import TODAY, scheduler, run, add_step
from tests.test_scheduler_scenarios_pc_04_3c import scenario_api
from app.models.audit import AuditEvent
from app.models.calendar_assignment import CalendarAssignment
from app.models.calendar_allocation import CalendarAllocation
from app.models.production_capacity import CapacityResource
from app.models.technical_card import TechnicalCard, TechnicalCardStageResult
from app.schemas.workshop_queue import WorkshopQueueReorder, WorkshopQueueApply
from app.services import workshop_queue as queue
from app.services.technical_card_fact_projection import fact_projection


def state(db):
    return {model.__tablename__: [queue._columns(row) for row in db.scalars(select(model).order_by(model.id))]
            for model in (CalendarAssignment, CalendarAllocation, TechnicalCard, TechnicalCardStageResult, AuditEvent)}


def prepare(factory, *, steps=False):
    if steps:
        add_step(factory)
    run(factory, 1)
    run(factory, 2)


def request(db, order=None):
    result = queue.read_workshop_queue(db, 1, today=TODAY)
    return WorkshopQueueReorder(revision=result.revision, ordered_snapshot_node_ids=(
        order if order is not None else [item.snapshot_node_id for item in reversed(result.items)]))


def apply(db, payload, preview):
    return queue.apply_workshop_queue(db, 1, WorkshopQueueApply(**payload.model_dump(),
        preview_fingerprint=preview.preview_fingerprint), actor=None, today=TODAY)


def test_read_and_preview_are_sql_read_only(scheduler):
    factory, engine = scheduler
    prepare(factory, steps=True)
    writes = []
    def track(_, __, statement, *args):
        if statement.lstrip().split()[0].upper() in {"INSERT", "UPDATE", "DELETE"}:
            writes.append(statement)
    event.listen(engine, 'before_cursor_execute', track)
    with factory() as db:
        before = state(db)
        payload = request(db)
        result = queue.preview_workshop_queue(db, 1, payload, today=TODAY)
        assert result.can_apply and len(result.changes) == 2
        assert result.changes[0].downstream_snapshot_node_ids
        assert not writes and state(db) == before
        assert result.changes[0].new_eta < result.changes[0].old_eta
    event.remove(engine, 'before_cursor_execute', track)


def test_apply_persists_manual_order_and_dates_without_fact_changes(scheduler):
    factory, _ = scheduler
    prepare(factory, steps=True)
    with factory() as db:
        facts = {card.id: (card.status, fact_projection(card)) for card in db.scalars(select(TechnicalCard))}
        payload = request(db)
        preview = queue.preview_workshop_queue(db, 1, payload, today=TODAY)
        result = apply(db, payload, preview)
        assert result.audit_event_id
        assert [item.snapshot_node_id for item in result.queue.items] == payload.ordered_snapshot_node_ids
        assert all(plan.persisted for plan in result.preview.affected_plans)
        assert {card.id: (card.status, fact_projection(card)) for card in db.scalars(select(TechnicalCard))} == facts
        assert all(row.priority is None for row in db.scalars(select(TechnicalCard)))
        assert sorted(row.queue_position for row in db.scalars(select(CalendarAssignment)) if row.queue_position) == [1, 2]
        assignments = {row.id: row for row in db.scalars(select(CalendarAssignment))}
        for allocation in db.scalars(select(CalendarAllocation)):
            owner = assignments[allocation.assignment_id]
            assert owner.planned_date <= allocation.date <= owner.planned_end_date
        audit = db.get(AuditEvent, result.audit_event_id)
        assert audit.source == 'workshop_queue' and audit.payload['new_order'] == payload.ordered_snapshot_node_ids
    with factory() as db:
        assert [item.snapshot_node_id for item in queue.read_workshop_queue(db, 1, today=TODAY).items] == payload.ordered_snapshot_node_ids


@pytest.mark.parametrize('mutation,code', [
    ('in_progress', 'queue_contains_protected_fact'), ('completed', 'queue_contains_protected_fact'),
    ('other_workshop', 'queue_cross_workshop_reorder'), ('duplicate', 'queue_item_not_waiting'),
    ('missing', 'queue_item_not_waiting'), ('unknown', 'queue_item_not_waiting'),
    ('locked', 'queue_contains_protected_fact'), ('cancelled', 'queue_item_not_waiting'),
])
def test_rejected_items_do_not_write(scheduler, mutation, code):
    factory, _ = scheduler
    prepare(factory)
    with factory() as db:
        node = db.get(TechnicalCard, 1).stage_results[0]
        other = db.get(TechnicalCard, 2).stage_results[0]
        if mutation in {'in_progress', 'completed'}:
            node.status = mutation
        elif mutation == 'other_workshop':
            node.production_stage_id = 2
        elif mutation == 'locked':
            db.get(TechnicalCard, 1).plan_locked = True
        elif mutation == 'cancelled':
            db.get(TechnicalCard, 1).status = 'cancelled'
        db.commit()
        current = queue.read_workshop_queue(db, 1, today=TODAY)
        order = [node.id, other.id]
        if mutation == 'duplicate':
            order = [node.id, node.id]
        elif mutation == 'missing':
            order = [node.id]
        elif mutation == 'unknown':
            order.append(999999)
        before = state(db)
        with pytest.raises(queue.WorkshopQueueConflict) as error:
            queue.preview_workshop_queue(db, 1, WorkshopQueueReorder(
                revision=current.revision, ordered_snapshot_node_ids=order), today=TODAY)
        assert error.value.diagnostic.code == code and state(db) == before


@pytest.mark.parametrize('mutation', ['capacity', 'quantity', 'fact', 'calendar_position'])
def test_stale_revision_rejects_apply_atomically(scheduler, mutation):
    factory, _ = scheduler
    prepare(factory)
    with factory() as db:
        payload = request(db)
        preview = queue.preview_workshop_queue(db, 1, payload, today=TODAY)
    with factory() as db:
        if mutation == 'capacity':
            db.get(CapacityResource, 'items').base_rate = 50
        elif mutation == 'quantity':
            db.get(TechnicalCard, 1).quantity = 200
        elif mutation == 'fact':
            db.get(TechnicalCard, 1).stage_results[0].status = 'in_progress'
        else:
            db.get(CalendarAssignment, 10).position = 8
        db.commit()
    with factory() as db:
        before = state(db)
        with pytest.raises(queue.WorkshopQueueConflict) as error:
            apply(db, payload, preview)
        assert error.value.diagnostic.code == 'workshop_queue_changed'
        assert state(db) == before


def test_bad_preview_fingerprint_rejected(scheduler):
    factory, _ = scheduler
    prepare(factory)
    with factory() as db:
        payload = request(db)
        preview = queue.preview_workshop_queue(db, 1, payload, today=TODAY)
        preview.preview_fingerprint = '0' * 64
        before = state(db)
        with pytest.raises(queue.WorkshopQueueConflict) as error:
            apply(db, payload, preview)
        assert error.value.diagnostic.code == 'workshop_queue_changed' and state(db) == before


def test_blocked_replan_preserves_entire_old_plan(scheduler):
    factory, _ = scheduler
    prepare(factory)
    with factory() as db:
        db.get(CapacityResource, 'items').base_rate = None
        db.commit()
        payload = request(db)
        before = state(db)
        preview = queue.preview_workshop_queue(db, 1, payload, today=TODAY)
        assert not preview.can_apply and preview.blockers[0].code == 'queue_replan_failed'
        with pytest.raises(queue.WorkshopQueueConflict):
            apply(db, payload, preview)
        assert state(db) == before


def test_same_order_noop_and_single_schedule_retains_override(scheduler):
    factory, _ = scheduler
    prepare(factory)
    with factory() as db:
        payload = request(db)
        apply(db, payload, queue.preview_workshop_queue(db, 1, payload, today=TODAY))
        unchanged = request(db, payload.ordered_snapshot_node_ids)
        before = state(db)
        response = apply(db, unchanged, queue.preview_workshop_queue(db, 1, unchanged, today=TODAY))
        assert response.audit_event_id is None and state(db) == before
    run(factory, 2)
    with factory() as db:
        assert [item.snapshot_node_id for item in queue.read_workshop_queue(db, 1, today=TODAY).items] == payload.ordered_snapshot_node_ids


def test_batch_scheduler_respects_manual_order(scheduler):
    from app.services.production_queue_scheduler import schedule_queue
    factory, _ = scheduler
    prepare(factory)
    with factory() as db:
        payload = request(db)
        apply(db, payload, queue.preview_workshop_queue(db, 1, payload, today=TODAY))
    with factory() as db:
        result = schedule_queue(db, today=TODAY)
        assert result.status == 'planned'
        current = queue.read_workshop_queue(db, 1, today=TODAY)
        assert [item.snapshot_node_id for item in current.items] == payload.ordered_snapshot_node_ids
        assert current.items[0].planned_start < current.items[1].planned_start


def test_completed_predecessor_plan_and_fact_preserved(scheduler):
    from app.services.technical_card_stages import complete_stage
    factory, _ = scheduler
    prepare(factory, steps=True)
    with factory() as db:
        complete_stage(db, 1, 1)
        complete_stage(db, 2, 1)
        db.expire_all()  # Compare persisted SQLite datetime representations.
        protected_nodes = {card.stage_results[0].id for card in db.scalars(select(TechnicalCard))}
        before = {row.id: queue._columns(row) for row in db.scalars(select(CalendarAssignment)) if row.stage_result_id in protected_nodes}
        facts = {row.id: queue._columns(row) for row in db.scalars(select(TechnicalCardStageResult)) if row.id in protected_nodes}
        payload = request(db)
        preview = queue.preview_workshop_queue(db, 1, payload, today=TODAY)
        assert preview.can_apply
        apply(db, payload, preview)
        assert {row.id: queue._columns(row) for row in db.scalars(select(CalendarAssignment)) if row.stage_result_id in protected_nodes} == before
        assert {row.id: queue._columns(row) for row in db.scalars(select(TechnicalCardStageResult)) if row.id in protected_nodes} == facts
        assert all(card.status == 'in_progress' for card in db.scalars(select(TechnicalCard)))


def test_failure_after_first_plan_write_rolls_back_everything(scheduler, monkeypatch):
    factory, _ = scheduler
    prepare(factory)
    real_persist = queue.persist_plan
    count = 0
    def fail_second(db, result, ids):
        nonlocal count
        count += 1
        if count == 2:
            raise queue.TechnicalCardConflictError('Simulated lost plan')
        real_persist(db, result, ids)
    monkeypatch.setattr(queue, 'persist_plan', fail_second)
    with factory() as db:
        payload = request(db)
        preview = queue.preview_workshop_queue(db, 1, payload, today=TODAY)
        before = state(db)
        with pytest.raises(queue.WorkshopQueueConflict) as error:
            apply(db, payload, preview)
        assert error.value.diagnostic.code == 'queue_replan_failed'
        assert state(db) == before


def test_shipping_risk_and_eta_match_saved_downstream_dates(scheduler):
    factory, _ = scheduler
    prepare(factory, steps=True)
    with factory() as db:
        db.get(TechnicalCard, 1).shipping_date = TODAY + timedelta(days=1)
        db.commit()
        payload = request(db)
        preview = queue.preview_workshop_queue(db, 1, payload, today=TODAY)
        change = next(row for row in preview.changes if row.technical_card_id == 1)
        assert change.old_risk == 'on_time' and change.new_risk == 'late'
        assert preview.can_apply and preview.warnings
        apply(db, payload, preview)
        eta = max(row.planned_end_date for row in db.scalars(select(CalendarAssignment)) if row.technical_card_id == 1)
        assert eta == change.new_eta


def test_unchanged_prefix_is_not_replanned(scheduler):
    from app.services.route_snapshot import copy_template_snapshot
    factory, _ = scheduler
    prepare(factory)
    with factory() as db:
        card = TechnicalCard(id=3, order_group_id=1, card_seq=3, number='QUEUE-3', quantity=100,
                             routing_template_id=1, planning_start_date=TODAY, shipping_date=TODAY + timedelta(days=20))
        db.add(card)
        db.flush()
        copy_template_snapshot(db, card)
        db.commit()
    run(factory, 3)
    with factory() as db:
        old = queue.read_workshop_queue(db, 1, today=TODAY)
        ids = [item.snapshot_node_id for item in old.items]
        before = {row.id: queue._columns(row) for row in db.scalars(select(CalendarAssignment)) if row.technical_card_id == 1}
        allocations = {row.id: queue._columns(row) for row in db.scalars(select(CalendarAllocation)) if row.assignment_id in before}
        payload = WorkshopQueueReorder(revision=old.revision, ordered_snapshot_node_ids=[ids[0], ids[2], ids[1]])
        preview = queue.preview_workshop_queue(db, 1, payload, today=TODAY)
        assert {plan.technical_card_id for plan in preview.affected_plans} == {2,3}
        apply(db, payload, preview)
        # Only the explicit waiting-order field of the prefix is assigned; plan and allocations stay identical.
        after = {row.id: queue._columns(row) for row in db.scalars(select(CalendarAssignment)) if row.technical_card_id == 1}
        for key in before:
            after[key]['queue_position'] = before[key]['queue_position']
            after[key]['updated_at'] = before[key]['updated_at']
        assert after == before
        assert {row.id: queue._columns(row) for row in db.scalars(select(CalendarAllocation)) if row.assignment_id in before} == allocations


def test_locked_downstream_anchor_blocks_reorder_without_mutation(scheduler):
    factory, _ = scheduler
    prepare(factory, steps=True)
    with factory() as db:
        node = db.get(TechnicalCard, 1).stage_results[1]
        saved = db.scalar(select(CalendarAssignment).where(CalendarAssignment.stage_result_id == node.id))
        saved.manual_lock = True
        saved.planning_mode = 'locked'
        db.commit()
        payload = request(db)
        before = state(db)
        preview = queue.preview_workshop_queue(db, 1, payload, today=TODAY)
        assert not preview.can_apply and preview.blockers
        with pytest.raises(queue.WorkshopQueueConflict):
            apply(db, payload, preview)
        assert state(db) == before


def test_one_of_only_selected_queue_ready_node(scheduler):
    from tests.test_route_variants_pc_04_4i import seed_variant
    factory, _ = scheduler
    nodes = seed_variant(factory)
    with factory() as db:
        db.get(TechnicalCardStageResult, int(nodes[1].split(':')[1])).status = 'completed'
        db.commit()
        result = queue.read_workshop_queue(db, 1, today=TODAY)
        selected = [item for item in result.items if item.technical_card_id == 3]
        assert len(selected) == 1 and selected[0].snapshot_node_id == int(nodes[3].split(':')[1])


def test_queue_read_query_count_does_not_grow_per_item(scheduler):
    from app.services.route_snapshot import copy_template_snapshot
    factory, engine = scheduler
    queries = []
    def track(_, __, statement, *args):
        if statement.lstrip().upper().startswith('SELECT'):
            queries.append(statement)
    event.listen(engine, 'before_cursor_execute', track)
    with factory() as db:
        assert len(queue.read_workshop_queue(db, 1, today=TODAY).items) == 2
        count = len(queries)
    with factory() as db:
        card = TechnicalCard(id=3, order_group_id=1, card_seq=3, number='QUEUE-3', quantity=100,
                             routing_template_id=1, planning_start_date=TODAY, shipping_date=TODAY + timedelta(days=20))
        db.add(card)
        db.flush()
        copy_template_snapshot(db, card)
        db.commit()
    queries.clear()
    with factory() as db:
        assert len(queue.read_workshop_queue(db, 1, today=TODAY).items) == 3
        assert len(queries) == count
    event.remove(engine, 'before_cursor_execute', track)


def test_http_contract_revision_headers_permissions(scenario_api, monkeypatch):
    factory, client = scenario_api
    monkeypatch.setattr(queue, '_today', lambda db, today: TODAY)
    prepare(factory)
    result = client.get('/production-calendar/workshops/1/queue')
    assert result.status_code == 200
    body = result.json()
    payload = dict(revision=body['revision'], ordered_snapshot_node_ids=[item['snapshot_node_id'] for item in reversed(body['items'])])
    preview = client.post('/production-calendar/workshops/1/queue/preview', json=payload)
    assert preview.status_code == 200 and preview.json()['can_apply']
    # No persisted actor is needed to test the stale rejection, before audit writes.
    payload['revision'] = '0' * 64
    response = client.post('/production-calendar/workshops/1/queue/apply', json={
        **payload, 'preview_fingerprint': preview.json()['preview_fingerprint']})
    assert response.status_code == 409 and response.headers['X-Diagnostic-Code'] == 'workshop_queue_changed'
    assert client.get('/production-calendar/workshops/99999/queue').status_code == 404


def test_http_apply_actor_and_permission_gate(scenario_api, monkeypatch):
    from app.api.deps_auth import get_current_platform_user
    from app.main import app
    from app.models.auth import PlatformUser
    factory, client = scenario_api
    monkeypatch.setattr(queue, '_today', lambda db, today: TODAY)
    prepare(factory)
    with factory() as db:
        db.add(PlatformUser(id=90, login='scenario-planner', display_name='Planner', password_hash='test-only'))
        db.commit()
    body = client.get('/production-calendar/workshops/1/queue').json()
    payload = dict(revision=body['revision'], ordered_snapshot_node_ids=[item['snapshot_node_id'] for item in reversed(body['items'])])
    preview = client.post('/production-calendar/workshops/1/queue/preview', json=payload).json()
    response = client.post('/production-calendar/workshops/1/queue/apply', json={
        **payload, 'preview_fingerprint': preview['preview_fingerprint']})
    assert response.status_code == 200
    with factory() as db:
        audit = db.get(AuditEvent, response.json()['audit_event_id'])
        assert audit.actor_platform_user_id == 90 and audit.actor_login == 'scenario-planner'
    app.dependency_overrides[get_current_platform_user] = lambda: PlatformUser(id=90, login='reader', roles=[])
    assert client.get('/production-calendar/workshops/1/queue').status_code == 200
    assert client.post('/production-calendar/workshops/1/queue/preview', json=payload).status_code == 403
    assert client.post('/production-calendar/workshops/1/queue/apply', json={
        **payload, 'preview_fingerprint': preview['preview_fingerprint']}).status_code == 403
    del app.dependency_overrides[get_current_platform_user]
    assert client.get('/production-calendar/workshops/1/queue').status_code == 401
