from datetime import timedelta, datetime, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import event, select

from tests.test_production_scheduler_pc_04_3a import scheduler, run, TODAY
from tests.test_manual_route_replan_pc_06_3b import prepare, request, snapshot
from app.models.technical_card import TechnicalCard, TechnicalCardStageResult
from app.models.calendar_assignment import CalendarAssignment
from app.models.production_capacity import CapacityResource
from app.services import planning_health as service
from app.services.manual_route_replan import preview_replan
from app.services.persisted_plan import read_persisted_plan


def health(db, day=TODAY):
    card = db.get(TechnicalCard, 1)
    return service.load_planning_health(db, [card], today=day)[1]


@pytest.mark.parametrize('days,overdue', [(1, True), (0, False), (-1, False)])
def test_pending_relative_to_platform_planning_date(scheduler, days, overdue):
    factory, _ = scheduler
    run(factory)
    with factory() as db:
        result = health(db, TODAY + timedelta(days=days))
        assert result.has_overdue_operations == overdue
        assert result.overdue_operation_count == int(overdue)
        assert result.overdue_days == max(days, 0)
        assert result.operations[0].can_replan
        assert not result.operations[0].is_protected
        assert result.replan_required == overdue
        assert result.planning_state == 'actual'


@pytest.mark.parametrize('status', ['in_progress', 'completed', 'skipped'])
def test_old_fact_is_protected_not_overdue(scheduler, status):
    factory, _ = scheduler
    prepare(factory)
    with factory() as db:
        node = min(db.get(TechnicalCard, 1).stage_results, key=lambda n: n.stage_order)
        node.status = status
        db.commit()
        result = health(db, TODAY + timedelta(days=2))
        op = result.operations[0]
        assert not op.is_overdue and op.is_protected and not op.can_replan


def test_multiple_overdue_ties_use_snapshot_order_and_persisted_eta(scheduler):
    factory, _ = scheduler
    prepare(factory, third=True)
    with factory() as db:
        result = health(db, TODAY + timedelta(days=2))
        summary = read_persisted_plan(db, db.get(TechnicalCard, 1))
        assert result.overdue_operation_count == 3
        assert result.earliest_overdue_snapshot_node_id == result.operations[0].snapshot_node_id
        assert result.earliest_overdue_operation == result.operations[0].operation_name
        assert result.earliest_overdue_workshop == result.operations[0].workshop_name
        assert result.earliest_overdue_date == TODAY and result.overdue_days == 2
        assert result.eta == summary.planned_completion_date
        assert result.shipping_date == summary.shipping_date
        assert result.slack_days == summary.buffer_days and result.on_time == summary.on_time
        assert result.route_total_operations == result.pending_operations == 3
        assert result.current_workshop_id == 1
        assert result.next_snapshot_node_id == result.operations[1].snapshot_node_id


def test_earliest_uses_date_before_route_order(scheduler):
    factory, _ = scheduler
    prepare(factory)
    with factory() as db:
        rows = list(db.scalars(select(CalendarAssignment).where(CalendarAssignment.stage_result_id.is_not(None))))
        rows[-1].planned_date = TODAY - timedelta(days=2)
        rows[-1].planned_end_date = TODAY - timedelta(days=2)
        db.commit()
        result = health(db, TODAY + timedelta(days=1))
        assert result.earliest_overdue_snapshot_node_id == rows[-1].stage_result_id
        assert result.overdue_days == 3


def test_risk_uses_saved_dates_and_existing_taxonomy(scheduler):
    factory, _ = scheduler
    prepare(factory)
    with factory() as db:
        db.get(TechnicalCard, 1).shipping_date = TODAY - timedelta(days=1)
        db.commit()
        result = health(db)
        assert result.eta == TODAY and result.slack_days == -1
        assert result.on_time is False and result.risk_level == 'late' and result.has_planning_issues


def test_fresh_stale_invalid_and_unplanned_are_explicit(scheduler):
    factory, _ = scheduler
    with factory() as db:
        result = health(db)
        assert result.planning_state == 'not_planned' and result.eta is None
        assert result.risk_level == 'unknown' and not result.replan_required and result.has_planning_issues
        assert not result.operations[0].can_replan
    run(factory)
    with factory() as db:
        assert health(db).planning_state == 'actual'
        db.get(CapacityResource, 'items').staff_count = 2
        db.commit()
        result = health(db)
        assert result.planning_state == 'stale' and result.replan_required
        db.get(TechnicalCard, 1).route_variant_groups = [{'broken': True}]
        db.commit()
        result = health(db)
        assert result.planning_state == 'invalid' and result.replan_required
        assert not result.operations and result.eta is None


@pytest.mark.parametrize('shipped', [False, True])
def test_completed_or_shipped_has_no_active_warning(scheduler, shipped):
    factory, _ = scheduler
    prepare(factory)
    with factory() as db:
        card = db.get(TechnicalCard, 1)
        card.status = 'completed'
        for node in card.stage_results:
            node.status = 'completed'
        if shipped:
            card.fulfillment_status = 'shipped'
            card.ready_to_ship_at = card.shipped_at = datetime.now(timezone.utc)
        db.commit()
        result = health(db, TODAY + timedelta(days=20))
        assert result.planning_state == 'completed'
        assert not result.replan_required and not result.has_overdue_operations and not result.has_planning_issues
        assert result.completed_operations == result.route_total_operations == 2
        assert all(op.is_protected and not op.can_replan for op in result.operations)
        assert result.next_operation is None


@pytest.mark.parametrize('mode,manual_lock,allowed', [('auto', False, True), ('locked', True, False),
    ('manual_adjusted', True, True)])
def test_can_replan_matches_manual_command_guards(scheduler, mode, manual_lock, allowed):
    factory, _ = scheduler
    prepare(factory)
    with factory() as db:
        payload = request(db)
        row = db.scalar(select(CalendarAssignment).where(CalendarAssignment.stage_result_id == payload.snapshot_node_id))
        row.planning_mode = mode
        row.manual_lock = manual_lock
        db.commit()
        result = health(db)
        op = next(op for op in result.operations if op.snapshot_node_id == payload.snapshot_node_id)
        preview = preview_replan(db, payload, today=TODAY)
        assert op.can_replan == allowed == preview.apply_allowed
        assert op.is_protected != allowed


def test_no_read_writes_even_with_dirty_session_and_list_detail_agree(scheduler, monkeypatch):
    factory, engine = scheduler
    prepare(factory)
    monkeypatch.setattr(service, 'new_card_planning_start', lambda db: TODAY)
    writes = []
    def observe(conn, cursor, sql, *args):
        if sql.lstrip().upper().startswith(('INSERT', 'UPDATE', 'DELETE')):
            writes.append(sql)
    with factory() as db:
        before = snapshot(db)
        card = db.get(TechnicalCard, 1)
        card.number = 'UNFLUSHED'
        event.listen(engine, 'before_cursor_execute', observe)
        try:
            detail = service.read_planning_health(db, 1)
            rows = service.list_manual_planning_health(db)
            row = next(row for row in rows if row.technical_card_id == 1)
            assert row.model_dump(exclude={'number'}) == detail.model_dump(exclude={'operations'})
            assert 'operations' not in row.model_dump()
        finally:
            event.remove(engine, 'before_cursor_execute', observe)
        assert not writes
        db.rollback()
        assert snapshot(db) == before


@pytest.mark.parametrize('protection', ['card_lock', 'pending_fact', 'cancelled'])
def test_pending_protection_is_shared_and_terminal_warnings_suppressed(scheduler, protection):
    factory, _ = scheduler
    prepare(factory)
    with factory() as db:
        card = db.get(TechnicalCard, 1)
        payload = request(db)
        if protection == 'card_lock':
            card.plan_locked = True
        elif protection == 'pending_fact':
            db.get(TechnicalCardStageResult, payload.snapshot_node_id).notes = 'Recorded production evidence'
        else:
            card.status = 'cancelled'
        db.commit()
        result = health(db, TODAY + timedelta(days=1))
        op = next(op for op in result.operations if op.snapshot_node_id == payload.snapshot_node_id)
        assert op.is_protected and not op.can_replan
        preview = preview_replan(db, payload, today=TODAY)
        assert not preview.apply_allowed and preview.blockers[0].code == 'manual_replan_protected'
        if protection in {'pending_fact', 'cancelled'}:
            assert not op.is_overdue
        if protection == 'cancelled':
            assert not result.replan_required and not result.has_planning_issues


def test_batch_query_count_does_not_scale_with_card_count(scheduler):
    factory, engine = scheduler
    prepare(factory)
    def measure(limit):
        queries = []
        def observe(conn, cursor, sql, *args):
            if sql.lstrip().upper().startswith('SELECT'):
                queries.append(sql)
        with factory() as db:
            event.listen(engine, 'before_cursor_execute', observe)
            try:
                rows = service.list_manual_planning_health(db, limit=limit)
            finally:
                event.remove(engine, 'before_cursor_execute', observe)
        return rows, len(queries)
    one, one_count = measure(1)
    many, many_count = measure(100)
    assert len(one) == 1 and len(many) > 1
    assert one_count == many_count


def test_endpoints_auth_not_found_slim_list_and_detail(scheduler):
    from app.main import app
    from app.database.session import get_db
    from app.api.deps_auth import get_current_platform_user
    from app.models.auth import PlatformUser
    factory, _ = scheduler
    prepare(factory)
    previous = dict(app.dependency_overrides)
    def session():
        with factory() as db:
            yield db
    try:
        app.dependency_overrides[get_db] = session
        with TestClient(app) as client:
            assert client.get('/technical-cards/1/planning-health').status_code == 401
            assert client.get('/production-calendar/manual-planning/cards').status_code == 401
            app.dependency_overrides[get_current_platform_user] = lambda: PlatformUser(id=1, login='reader')
            detail = client.get('/technical-cards/1/planning-health')
            listing = client.get('/production-calendar/manual-planning/cards')
            assert detail.status_code == listing.status_code == 200
            row = next(row for row in listing.json() if row['technical_card_id'] == 1)
            assert {k:v for k,v in row.items() if k != 'number'} == {k:v for k,v in detail.json().items() if k != 'operations'}
            assert client.get('/technical-cards/999/planning-health').status_code == 404
            assert client.get('/production-calendar/manual-planning/cards?limit=501').status_code == 422
    finally:
        app.dependency_overrides.clear()
        app.dependency_overrides.update(previous)
