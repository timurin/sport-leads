import pytest
from sqlalchemy import select

from tests.test_production_scheduler_pc_04_3a import scheduler, run, add_step
from app.models.technical_card import TechnicalCard, TechnicalCardStageResult
from app.models.calendar_assignment import CalendarAssignment
from app.models.calendar_allocation import CalendarAllocation
from app.services.technical_card_stages import start_stage, complete_stage, rollback_stage_for_shop_kanban
from app.services.technical_cards import TechnicalCardValidationError, to_technical_card_list_read
from app.services.technical_card_fact_projection import fact_projection, fact_integrity_issues


def calendar_state(db):
    return {
        model.__tablename__: [
            {column.name: getattr(row, column.name) for column in model.__table__.columns}
            for row in db.scalars(select(model).order_by(model.id))
        ]
        for model in (CalendarAssignment, CalendarAllocation)
    }


def test_completed_workshop_advances_without_starting_future_work(scheduler):
    factory, _ = scheduler
    add_step(factory)
    run(factory)
    with factory() as db:
        card = db.get(TechnicalCard, 1)
        first, second = sorted(card.stage_results, key=lambda row: row.stage_order)
        second.production_stage_id = 2
        before = calendar_state(db)
        first.status = 'completed'
        assert fact_projection(card)['current_workshop_id'] == 2
        assert second.status == 'pending'
        assert calendar_state(db) == before


def test_parallel_branches_hold_current_workshop_and_join_gate(scheduler):
    from app.models.technical_card import TechnicalCardRouteEdge
    from app.services.technical_card_stages import _previous_stages_completed

    factory, _ = scheduler
    add_step(factory)
    with factory() as db:
        card = db.get(TechnicalCard, 1)
        first, branch = sorted(card.stage_results, key=lambda row: row.stage_order)
        join = TechnicalCardStageResult(technical_card_id=1, stage_order=3,
                                       stage_label='Packing', production_stage_id=2)
        card.stage_results.append(join)
        db.flush()
        for edge in list(db.scalars(select(TechnicalCardRouteEdge))):
            db.delete(edge)
        db.flush()
        for predecessor in (first, branch):
            db.add(TechnicalCardRouteEdge(technical_card_id=1,
                                         predecessor_stage_result_id=predecessor.id,
                                         successor_stage_result_id=join.id))
        db.flush()
        first.status = 'completed'
        branch.status = 'in_progress'
        assert fact_projection(card)['current_workshop_id'] == 1
        with pytest.raises(TechnicalCardValidationError):
            _previous_stages_completed(db, card, join)
        branch.status = 'completed'
        _previous_stages_completed(db, card, join)
        assert fact_projection(card)['current_workshop_id'] == 2


def test_one_of_unselected_members_do_not_hold_workshop(scheduler):
    from tests.test_route_variants_pc_04_4i import seed_variant
    from app.services.technical_card_stages import _sync_current_stage, _maybe_complete_card
    from app.services.route_variants import active_stage_results

    factory, _ = scheduler
    seed_variant(factory)
    with factory() as db:
        card = db.get(TechnicalCard, 3)
        active = active_stage_results(card)
        assert len(active) == 3
        for stage in active:
            stage.status = 'completed'
        _sync_current_stage(card)
        _maybe_complete_card(card)
        assert card.status == 'completed'
        assert len([stage for stage in card.stage_results if stage.status == 'pending']) == 2
        assert not fact_integrity_issues(card)


def test_plan_is_not_fact_and_start_sets_lifecycle(scheduler):
    factory, _ = scheduler
    add_step(factory)
    run(factory)
    with factory() as db:
        card = db.get(TechnicalCard, 1)
        before = calendar_state(db)
        row = to_technical_card_list_read(card)
        assert row.status == 'draft' and row.current_workshop_id == 1
        assert not any(s.status != 'pending' for s in card.stage_results)
        start_stage(db, 1, 1)
        assert card.status == 'in_progress'
        assert fact_projection(card)['current_workshop_id'] == 1
        assert calendar_state(db) == before


def test_complete_and_guarded_rollback_leave_calendar_unchanged(scheduler):
    factory, _ = scheduler
    run(factory)
    with factory() as db:
        before = calendar_state(db)
        card = complete_stage(db, 1, 1)
        assert card.status == 'completed'
        assert calendar_state(db) == before
        card = rollback_stage_for_shop_kanban(db, 1, 1)
        assert card.status == 'in_progress'
        assert card.stage_results[0].status == 'in_progress'
        assert calendar_state(db) == before


def test_completion_cannot_skip_in_progress_sibling(scheduler):
    factory, _ = scheduler
    add_step(factory)
    with factory() as db:
        from app.models.shop_routing import ShopRoutingStageLine
        from app.services.route_snapshot import append_snapshot_line
        line = ShopRoutingStageLine(id=3, routing_template_id=1, stage_order=3, stage_label='Production', production_stage_id=1, tech_operation_id=2)
        db.add(line)
        db.flush()
        append_snapshot_line(db, db.get(TechnicalCard, 1), line)
        db.commit()
    run(factory)
    with factory() as db:
        card = db.get(TechnicalCard, 1)
        first, second, third = sorted(card.stage_results, key=lambda s: s.stage_order)
        # Parallel same-workshop nodes may both have production fact.
        second.status = 'in_progress'
        db.commit()
        before = calendar_state(db)
        complete_stage(db, 1, first.stage_order)
        assert card.current_stage_order == second.stage_order
        assert card.status == 'in_progress'
        assert third.status == 'pending'
        assert calendar_state(db) == before


@pytest.mark.parametrize('later_status', ['in_progress', 'completed', 'skipped'])
def test_kanban_rollback_preserves_later_fact_and_calendar(scheduler, later_status):
    factory, _ = scheduler
    add_step(factory)
    run(factory)
    with factory() as db:
        complete_stage(db, 1, 1)
        card = db.get(TechnicalCard, 1)
        later = next(s for s in card.stage_results if s.stage_order == 2)
        later.status = later_status
        later.work_done = 'retained production fact'
        db.commit()
        before = calendar_state(db)
        with pytest.raises(TechnicalCardValidationError):
            rollback_stage_for_shop_kanban(db, 1, 1)
        db.rollback()
        assert later.status == later_status and later.work_done == 'retained production fact'
        assert calendar_state(db) == before


def test_read_projection_and_diagnostics_do_not_repair_stored_fact(scheduler):
    factory, _ = scheduler
    add_step(factory)
    with factory() as db:
        card = db.get(TechnicalCard, 1)
        first, second = sorted(card.stage_results, key=lambda s: s.stage_order)
        first.status = 'completed'
        card.current_stage_order = 1
        db.commit()
        issues = fact_integrity_issues(card)
        assert {r.code for r in issues} == {'production_state_projection_mismatch'}
        assert {r.reason for r in issues} == {'stored_current_stage_cache', 'stored_lifecycle_cache'}
        assert all(r.category == 'INTEGRITY' and r.source_value != r.actual_value for r in issues)
        assert to_technical_card_list_read(card).current_stage_order == second.stage_order
        assert card.current_stage_order == 1 and card.status == 'draft'
