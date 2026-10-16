from datetime import timedelta
from decimal import Decimal
import pytest
from sqlalchemy import select

from tests.test_production_scheduler_pc_04_3a import scheduler, run, TODAY
from tests.test_route_reapply_ic_g01 import fingerprint
from tests.test_work_center_scheduler_pc_04_4d import plotters
from app.models.calendar_allocation import CalendarAllocation
from app.models.calendar_assignment import CalendarAssignment
from app.models.production_capacity import CapacityResource
from app.models.shop_routing import WorkCenter
from app.models.tech_operation import TechOperation
from app.models.technical_card import TechnicalCard
from app.schemas.calendar_allocation import CalendarAllocationCreate
from app.schemas.production_calendar import AssignmentUpdate
from app.services.calendar_allocations import add_allocation, AllocationError
from app.services.calendar_plan_linkage import PlanLinkageConflict
from app.services.calendar_allocation_consistency import assignment_consistency, card_consistency
from app.services.production_calendar import save
from app.services.production_scheduler import persist_plan


def clear_allocations(db):
    for row in db.scalars(select(CalendarAllocation)):
        db.delete(row)
    db.commit()


@pytest.mark.parametrize("offset", [-1, 1])
def test_allocation_outside_inclusive_daily_span_rejected_without_writes(scheduler, offset):
    factory, _ = scheduler
    plan = run(factory)
    with factory() as db:
        clear_allocations(db)  # Deliberate missing-allocation fixture, not local data repair.
        before = fingerprint(db)
        with pytest.raises(PlanLinkageConflict) as error:
            add_allocation(db, CalendarAllocationCreate(assignment_id=plan.steps[0].assignment_id,
                resource_key="items", date=TODAY + timedelta(days=offset), allocated_amount=100, capacity_unit="item"))
        assert error.value.code == "calendar_allocation_outside_assignment"
        assert error.value.category == "INTEGRITY" and fingerprint(db) == before


def test_valid_single_day_allocation_can_restore_complete_known_demand(scheduler):
    factory, _ = scheduler
    plan = run(factory)
    with factory() as db:
        clear_allocations(db)
        row = add_allocation(db, CalendarAllocationCreate(assignment_id=plan.steps[0].assignment_id,
            resource_key="items", date=TODAY, allocated_amount=100, capacity_unit="item"))
        assert row.date == TODAY and not card_consistency(db, 1)


@pytest.mark.parametrize("amount", [50, 101])
def test_partial_and_excess_amounts_cannot_be_persisted(scheduler, amount):
    factory, _ = scheduler
    plan = run(factory)
    with factory() as db:
        clear_allocations(db)
        before = fingerprint(db)
        with pytest.raises(PlanLinkageConflict) as error:
            add_allocation(db, CalendarAllocationCreate(assignment_id=plan.steps[0].assignment_id,
                resource_key="items", date=TODAY, allocated_amount=amount, capacity_unit="item"))
        assert error.value.code == "calendar_allocation_amount_mismatch"
        assert error.value.category == "DATA_FLOW" and fingerprint(db) == before


def test_duplicate_extra_allocation_does_not_double_amount(scheduler):
    factory, _ = scheduler
    plan = run(factory)
    with factory() as db:
        with pytest.raises(PlanLinkageConflict) as error:
            add_allocation(db, CalendarAllocationCreate(assignment_id=plan.steps[0].assignment_id,
                resource_key="items", date=TODAY, allocated_amount=100, capacity_unit="item"))
        assert error.value.code == "calendar_allocation_amount_mismatch"
        assert db.scalar(select(CalendarAllocation)).allocated_amount == 100


def test_incompatible_unit_rejected_before_insert(scheduler):
    factory, _ = scheduler
    plan = run(factory)
    with factory() as db:
        with pytest.raises(AllocationError):
            add_allocation(db, CalendarAllocationCreate(assignment_id=plan.steps[0].assignment_id,
                resource_key="items", date=TODAY, allocated_amount=100, capacity_unit="linear_meter"))


@pytest.mark.parametrize("change", ["date", "unit", "amount", "resource"])
def test_proposed_replan_consistency_preflight_precedes_old_plan_deletion(scheduler, change):
    factory, _ = scheduler
    run(factory)
    proposal = run(factory, persist=False)
    allocation = proposal.steps[0].allocations[0]
    if change == "date": allocation.date += timedelta(days=1)
    elif change == "unit": allocation.capacity_unit = "linear_meter"
    elif change == "amount": allocation.allocated_amount -= 1
    else: allocation.resource_key = "nonexistent"
    with factory() as db:
        before = fingerprint(db)
        with pytest.raises(PlanLinkageConflict):
            persist_plan(db, proposal, {proposal.steps[0].assignment_id} if proposal.steps[0].assignment_id else
                {row.id for row in db.scalars(select(CalendarAssignment).where(CalendarAssignment.stage_result_id.is_not(None)))})
        assert fingerprint(db) == before


def test_replan_replaces_old_amounts_and_dates_atomically(scheduler):
    factory, _ = scheduler
    run(factory)
    with factory() as db:
        db.get(TechnicalCard, 1).quantity = 150
        db.commit()
        assert any(d.code == "calendar_allocation_amount_mismatch" for d in card_consistency(db, 1))
    plan = run(factory)
    with factory() as db:
        assert plan.status == "planned" and not card_consistency(db, 1)
        rows = list(db.scalars(select(CalendarAllocation)))
        assert sum(row.allocated_amount for row in rows) == 150
        assert all(db.get(CalendarAssignment, row.assignment_id).planned_date <= row.date <=
                   db.get(CalendarAssignment, row.assignment_id).planned_end_date for row in rows)


@pytest.mark.parametrize("amount,accepted", [("0.0003", True), ("0.0002", False), ("0.0004", False)])
def test_rounding_matches_single_total_ceiling_without_lost_or_extra_demand(scheduler, amount, accepted):
    factory, _ = scheduler
    with factory() as db:
        resource = db.get(CapacityResource, "items")
        resource.resource_type, resource.capacity_unit, resource.calculation_mode = "labor", "labor_hour", "explicit_hours"
        resource.base_rate = None
        operation = db.get(TechOperation, 1)
        operation.demand_rule, operation.demand_duration_seconds = "fixed_per_order", 1
        db.commit()
    plan = run(factory)
    with factory() as db:
        assert db.scalar(select(CalendarAllocation)).allocated_amount == Decimal("0.0003")
        clear_allocations(db)
        payload = CalendarAllocationCreate(assignment_id=plan.steps[0].assignment_id, resource_key="items",
            date=TODAY, allocated_amount=Decimal(amount), capacity_unit="labor_hour")
        if accepted:
            add_allocation(db, payload)
            assert not card_consistency(db, 1)
        else:
            with pytest.raises(PlanLinkageConflict): add_allocation(db, payload)


def test_milestone_demand_has_no_capacity_allocation(scheduler):
    factory, _ = scheduler
    with factory() as db:
        resource = db.get(CapacityResource, "items")
        resource.resource_type, resource.capacity_unit, resource.calculation_mode = "milestone", None, "milestone"
        resource.base_rate = resource.staff_count = resource.hours_per_day = None
        db.commit()
    plan = run(factory)
    with factory() as db:
        assert plan.status == "planned" and not list(db.scalars(select(CalendarAllocation)))
        assert not card_consistency(db, 1)
        with pytest.raises(AllocationError):
            add_allocation(db, CalendarAllocationCreate(assignment_id=plan.steps[0].assignment_id,
                resource_key="items", date=TODAY, allocated_amount=1, capacity_unit="item"))


def test_one_of_allocates_only_selected_member_and_diagnoses_corrupted_alternative(scheduler):
    from tests.test_route_variants_pc_04_4i import seed_variant
    factory, _ = scheduler
    nodes = seed_variant(factory)
    plan = run(factory, card=3)
    with factory() as db:
        assert not card_consistency(db, 3)
        selected = next(step for step in plan.steps if step.snapshot_node_id == int(nodes[3].split(":")[1]))
        assignment = db.get(CalendarAssignment, selected.assignment_id)
        assignment.stage_result_id = int(nodes[2].split(":")[1])
        assignment.routing_stage_line_id = db.get(TechnicalCard, 3).stage_results[1].source_routing_stage_line_id
        db.commit()
        assert any(d.reason == "unselected_or_missing_snapshot" for d in assignment_consistency(db, assignment))


def test_unit_change_and_resource_delete_with_allocations_are_controlled_conflicts(scheduler):
    from app.services.capacity_resources import save_resource, delete_resource
    from app.schemas.production_capacity import CapacityResourceWrite
    factory, _ = scheduler
    run(factory)
    with factory() as db:
        before = fingerprint(db)
        with pytest.raises(PlanLinkageConflict) as error:
            save_resource(db, "items", CapacityResourceWrite(name="Items", resource_type="throughput", production_stage_id=1,
                capacity_unit="linear_meter", calculation_mode="rate", base_rate=100, resource_count=1,
                hours_per_day=1, shifts_per_day=1, efficiency=1, working_days=list(range(7))))
        assert error.value.code == "calendar_allocation_unit_mismatch"
        with pytest.raises(PlanLinkageConflict): delete_resource(db, "items")
        assert fingerprint(db) == before


def test_inactive_work_center_rejects_new_allocations_and_live_deactivation(scheduler):
    from app.services.shop_routings import update_work_center
    from app.schemas.shop_routing import WorkCenterUpdate
    factory, _ = scheduler
    with factory() as db:
        db.add(WorkCenter(id=9, name="Machine", code="machine", production_stage_id=1))
        db.flush()
        resource = db.get(CapacityResource, "items")
        resource.resource_type, resource.work_center_id, resource.staff_count = "machine", 9, None
        db.commit()
    plan = run(factory)
    with factory() as db:
        with pytest.raises(PlanLinkageConflict): update_work_center(db, 9, WorkCenterUpdate(is_active=False))
        db.get(WorkCenter, 9).is_active = False  # Isolated legacy corruption, no service bypass claimed.
        db.commit()
        clear_allocations(db)
        with pytest.raises(PlanLinkageConflict) as error:
            add_allocation(db, CalendarAllocationCreate(assignment_id=plan.steps[0].assignment_id,
                resource_key="items", date=TODAY, allocated_amount=100, capacity_unit="item"))
        assert error.value.code == "calendar_allocation_resource_mismatch"


def test_operation_resource_link_in_use_cannot_be_detached(scheduler):
    from app.services.tech_operations import update_tech_operation
    from app.schemas.tech_operation import TechOperationUpdate
    factory, _ = scheduler
    run(factory)
    with factory() as db:
        before = fingerprint(db)
        with pytest.raises(PlanLinkageConflict) as error:
            update_tech_operation(db, 1, TechOperationUpdate(capacity_resource_keys=[]))
        assert error.value.code == "calendar_allocation_resource_mismatch"
        assert fingerprint(db) == before


def test_assignment_span_can_expand_but_cannot_exclude_saved_daily_load(scheduler):
    factory, _ = scheduler
    plan = run(factory)
    with factory() as db:
        save(db, AssignmentUpdate(production_stage_id=1, planned_date=TODAY - timedelta(days=1),
            planned_end_date=TODAY + timedelta(days=1)), plan.steps[0].assignment_id)
        before = fingerprint(db)
        with pytest.raises(PlanLinkageConflict):
            save(db, AssignmentUpdate(production_stage_id=1, planned_date=TODAY + timedelta(days=1)), plan.steps[0].assignment_id)
        assert fingerprint(db) == before


def test_inactive_incompatible_machine_alternative_does_not_block_selected_plan(plotters):
    with plotters() as db:
        db.get(WorkCenter, 4).is_active = False
        db.get(CapacityResource, "plotter-test-4").capacity_unit = "item"
        db.commit()
    result = run(plotters)
    assert result.status == "planned"
    with plotters() as db:
        assert not card_consistency(db, 1)
