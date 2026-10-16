"""Audit evidence: assert current guard gaps, not proposed future business rules.

All writes use isolated SQLite fixtures. These tests never repair local/VPS data.
When a dedicated guard is implemented, update the matching audit row/test.
"""
from datetime import timedelta
from decimal import Decimal
import pytest

from sqlalchemy import select

from tests.test_production_scheduler_pc_04_3a import scheduler, TODAY, run
from app.models.calendar_assignment import CalendarAssignment
from app.models.calendar_allocation import CalendarAllocation
from app.models.technical_card import TechnicalCard
from app.schemas.production_calendar import AssignmentUpdate
from app.schemas.production_capacity import CapacityResourceWrite
from app.schemas.technical_card import TechnicalCardStageFactRequest
from app.services.technical_card_stages import start_stage, update_stage_fact
from app.services.technical_cards import apply_routing_template, set_technical_card_quantity
from app.services.production_calendar import remove, save
from app.services.capacity_resources import save_resource
from app.services.platform_health import read_health
from app.services.calendar_diagnostics import card_calendar_evidence


def test_ic_rs_03_started_fact_is_preserved_by_explicit_reapply(scheduler):
    factory, _ = scheduler
    run(factory)
    with factory() as db:
        start_stage(db, 1, 1)
        card = update_stage_fact(db, 1, 1, TechnicalCardStageFactRequest(
            work_done="Recorded work", duration_seconds=60, performer_name="Operator"))
        assert card.stage_results[0].started_at is not None
        node_id = card.stage_results[0].id
        started_at = card.stage_results[0].started_at
        reapplied = apply_routing_template(db, 1, 1)
        assert reapplied.status == "in_progress"
        stage = reapplied.stage_results[0]
        assert stage.id == node_id and stage.status == "in_progress" and stage.started_at == started_at
        assert stage.work_done == "Recorded work" and stage.duration_seconds == 60 and stage.performer_name == "Operator"
        row = db.scalar(select(CalendarAssignment).where(CalendarAssignment.id != 10))
        assert row.stage_result_id == node_id


def test_ic_sc_04_started_operation_cannot_lose_saved_plan_via_manual_delete(scheduler):
    factory, _ = scheduler
    plan = run(factory)
    with factory() as db:
        card = start_stage(db, 1, 1)
        from app.services.calendar_plan_linkage import PlanLinkageConflict
        with pytest.raises(PlanLinkageConflict):
            remove(db, plan.steps[0].assignment_id)
        assert card.stage_results[0].status == "in_progress"
        assert not card_calendar_evidence(db, card)[1]
        assert db.scalar(select(CalendarAllocation.id)) is not None


def test_ic_sc_05_manual_date_move_cannot_leave_allocations_outside_plan(scheduler):
    factory, _ = scheduler
    plan = run(factory)
    with factory() as db:
        from app.services.calendar_plan_linkage import PlanLinkageConflict
        with pytest.raises(PlanLinkageConflict) as error:
            save(db, AssignmentUpdate(production_stage_id=1, planned_date=TODAY + timedelta(days=2),
                 planned_end_date=TODAY + timedelta(days=2), position=0), plan.steps[0].assignment_id)
        assert error.value.code == "calendar_allocation_outside_assignment"
        allocation = db.scalar(select(CalendarAllocation))
        assert allocation.date == TODAY
        assert not any(d.code == "calendar_allocation_outside_assignment" for d in read_health(db).diagnostics)


def test_ic_dc_03_resource_unit_cannot_change_with_saved_allocations(scheduler):
    factory, _ = scheduler
    run(factory)
    with factory() as db:
        from app.services.calendar_plan_linkage import PlanLinkageConflict
        with pytest.raises(PlanLinkageConflict):
            save_resource(db, "items", CapacityResourceWrite(name="Items", resource_type="throughput",
                production_stage_id=1, capacity_unit="linear_meter", calculation_mode="rate", base_rate=100,
                resource_count=1, hours_per_day=1, shifts_per_day=1, efficiency=1, working_days=list(range(7))))
        allocation = db.scalar(select(CalendarAllocation))
        assert allocation.capacity_unit == "item"
        assert not any(d.code == "calendar_allocation_unit_mismatch" for d in read_health(db).diagnostics)


def test_ic_rs_01_partial_snapshot_missing_required_node_blocks_schedule(scheduler):
    from tests.test_production_scheduler_pc_04_3a import add_step
    factory, _ = scheduler
    add_step(factory)
    with factory() as db:
        card = db.get(TechnicalCard, 1)
        missing = card.stage_results[1]
        card.stage_results.remove(missing)
        db.delete(missing)
        db.commit()  # Legacy/DB corruption, not a supported public snapshot-write API.
        assert not any(d.code == "route_snapshot_missing" for d in read_health(db).diagnostics if d.entity_id == 1)
    plan = run(factory)
    assert not plan.persisted and plan.status == "blocked"
    assert plan.deviations[0].reason == "route_requires_review_before_planning"


def test_ic_ov_05_quantity_edit_requires_replan_before_start(scheduler):
    factory, _ = scheduler
    run(factory)
    with factory() as db:
        card = set_technical_card_quantity(db, 1, Decimal("50"))
        assert card.quantity == 50
        assert db.scalar(select(CalendarAllocation.allocated_amount)) == 100
        from app.services.calendar_plan_linkage import PlanLinkageConflict
        with pytest.raises(PlanLinkageConflict) as error:
            start_stage(db, 1, 1)
        assert error.value.code == "calendar_plan_stale_after_demand_change"
        assert any(d.code == error.value.code for d in read_health(db).diagnostics)
