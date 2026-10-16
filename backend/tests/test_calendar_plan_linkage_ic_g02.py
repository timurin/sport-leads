"""Saved-plan linkage guards use real services and isolated database fixtures."""
from sqlalchemy import event, select, null
import pytest

from tests.test_production_scheduler_pc_04_3a import scheduler, run, add_step, TODAY
from tests.test_scheduler_scenarios_pc_04_3c import scenario_api
from tests.test_route_reapply_ic_g01 import fingerprint
from app.models.audit import AuditEvent
from app.models.calendar_assignment import CalendarAssignment
from app.models.calendar_allocation import CalendarAllocation
from app.models.shop_routing import ShopRoutingStageLine
from app.models.technical_card import TechnicalCard
from app.schemas.production_calendar import AssignmentUpdate
from app.services.calendar_plan_linkage import PlanLinkageConflict, card_linkage_issues
from app.services.calendar_plan_lifecycle import detach_for_nodes, detach_for_route_lines
from app.services.production_calendar import save, remove
from app.services.production_scheduler import delete_auto_plan
from app.services.technical_card_stages import start_stage, complete_stage
from app.services.technical_cards import apply_routing_template
from app.services.platform_health import read_health


def test_schedule_replan_and_delete_release_allocations_with_lifecycle(scheduler):
    factory, _ = scheduler
    run(factory)
    plan = run(factory)
    with factory() as db:
        assert not card_linkage_issues(db, 1)
        for allocation in db.scalars(select(CalendarAllocation)):
            assert db.get(CalendarAssignment, allocation.assignment_id).stage_result_id == plan.steps[0].snapshot_node_id
        events = list(db.scalars(select(AuditEvent)))
        replan = next(row for row in events if row.action == "calendar.assignment_replanned")
        assert replan.payload["previous_state"]["calendar_assignment_id"] is not None
        assert replan.payload["snapshot_node_id"] == plan.steps[0].snapshot_node_id
        remove(db, plan.steps[0].assignment_id)
        assert db.scalar(select(CalendarAllocation.id)) is None
        assert db.get(CalendarAssignment, 10) is not None  # Entry marker remains.


@pytest.mark.parametrize("status", ["in_progress", "completed"])
@pytest.mark.parametrize("command", ["delete", "snapshot_detach", "route_detach", "auto_replace", "template_replace", "template_delete"])
def test_fact_mapping_cannot_disappear_and_rejection_has_no_writes(scheduler, status, command):
    factory, engine = scheduler
    plan = run(factory)
    with factory() as db:
        start_stage(db, 1, 1)
        if status == "completed":
            complete_stage(db, 1, 1)
        before = fingerprint(db)
        writes = []
        def track(conn, cursor, statement, parameters, context, executemany):
            if statement.lstrip().upper().startswith(("INSERT", "UPDATE", "DELETE")):
                writes.append(statement)
        event.listen(engine, "before_cursor_execute", track)
        try:
            with pytest.raises(PlanLinkageConflict) as error:
                if command == "delete":
                    remove(db, plan.steps[0].assignment_id)
                elif command == "snapshot_detach":
                    detach_for_nodes(db, [plan.steps[0].snapshot_node_id], reason="snapshot_reapplied")
                elif command == "route_detach":
                    detach_for_route_lines(db, [1])
                elif command == "auto_replace":
                    delete_auto_plan(db, {plan.steps[0].assignment_id})
                elif command == "template_replace":
                    from app.services.shop_routings import update_routing_template
                    from app.schemas.shop_routing import ShopRoutingTemplateUpdate
                    update_routing_template(db, 1, ShopRoutingTemplateUpdate(name="New name", stages=[{
                        "stage_order": 1, "production_stage_id": 1, "tech_operation_id": 1}]))
                else:
                    from app.services.shop_routings import delete_routing_template
                    delete_routing_template(db, 1)
            assert error.value.category == "INTEGRITY"
            assert error.value.diagnostic.debug_details["reason_code"] == "production_fact_plan_protected"
            assert fingerprint(db) == before and not writes
        finally:
            event.remove(engine, "before_cursor_execute", track)


def test_manual_assignment_cannot_switch_to_another_snapshot_operation(scheduler):
    factory, _ = scheduler
    add_step(factory)
    plan = run(factory)
    with factory() as db:
        before = fingerprint(db)
        with pytest.raises(PlanLinkageConflict) as error:
            save(db, AssignmentUpdate(production_stage_id=1, planned_date=TODAY, routing_stage_line_id=2), plan.steps[0].assignment_id)
        assert error.value.code == "calendar_assignment_operation_mismatch"
        assert fingerprint(db) == before


def test_future_snapshot_change_retires_plan_and_allocations_without_guessing_order(scheduler):
    factory, _ = scheduler
    add_step(factory)
    plan = run(factory)
    with factory() as db:
        complete_stage(db, 1, 1)
        db.get(ShopRoutingStageLine, 2).stage_label = "New future operation"
        db.commit()
        card = apply_routing_template(db, 1, 1)
        assert db.get(CalendarAssignment, plan.steps[0].assignment_id).stage_result_id == card.stage_results[0].id
        assert db.get(CalendarAssignment, plan.steps[1].assignment_id) is None
        assert not list(db.scalars(select(CalendarAllocation).where(CalendarAllocation.assignment_id == plan.steps[1].assignment_id)))
        assert not card_linkage_issues(db, 1)
        assert run(factory).status == "planned"


@pytest.mark.parametrize("corruption,code", [
    ("missing", "calendar_assignment_missing_snapshot"),
    ("foreign", "calendar_assignment_snapshot_mismatch"),
    ("routing", "calendar_assignment_operation_mismatch"),
    ("operation", "calendar_assignment_operation_mismatch"),
])
def test_diagnostic_and_scheduler_catch_corrupted_mapping_without_repair(scheduler, corruption, code):
    factory, _ = scheduler
    add_step(factory)
    plan = run(factory)
    with factory() as db:
        row = db.get(CalendarAssignment, plan.steps[0].assignment_id)
        if corruption == "missing":
            row.stage_result_id = None
        elif corruption == "foreign":
            row.stage_result_id = db.get(TechnicalCard, 2).stage_results[0].id
        elif corruption == "routing":
            row.routing_stage_line_id = None
        else:
            db.get(TechnicalCard, 1).stage_results[0].tech_operation_id = 2
        db.commit()
        before = fingerprint(db)
        diagnostic = next(d for d in read_health(db).diagnostics if d.code == code and d.entity_id == 1)
        assert diagnostic.category == "INTEGRITY" and diagnostic.fix_action
        assert diagnostic.debug_details["assignment_id"] == row.id
        assert diagnostic.debug_details["allocation_count"] > 0
        assert "expected_mapping" in diagnostic.debug_details and "actual_mapping" in diagnostic.debug_details
        result = run(factory)
        assert result.status == "blocked" and result.deviations[0].reason == code
        assert fingerprint(db) == before


def test_orphan_allocation_diagnostic_in_intentionally_corrupted_fixture(scheduler):
    factory, engine = scheduler
    with engine.connect() as connection:
        connection.exec_driver_sql("PRAGMA foreign_keys=OFF")
    with factory() as db:
        db.add(CalendarAllocation(assignment_id=999, resource_key="items", date=TODAY, allocated_amount=1, capacity_unit="item"))
        db.commit()
        diagnostic = next(d for d in read_health(db).diagnostics if d.code == "calendar_allocation_orphan")
        assert diagnostic.category == "INTEGRITY"
        assert diagnostic.debug_details["assignment_id"] == 999
        assert diagnostic.debug_details["technical_card_id"] is None  # Unknown, not guessed.


def test_http_delete_conflict_and_template_conflict_keep_string_contract(scenario_api):
    factory, client = scenario_api
    plan = run(factory)
    with factory() as db:
        start_stage(db, 1, 1)
        before = fingerprint(db)
    for response in [client.delete(f"/production-calendar/assignments/{plan.steps[0].assignment_id}"),
                     client.delete("/shop-routings/1")]:
        assert response.status_code == 409, response.text
        assert response.headers["X-Diagnostic-Category"] == "INTEGRITY"
        assert isinstance(response.json()["detail"], str)
    with factory() as db:
        assert fingerprint(db) == before


def test_live_template_edit_does_not_invalidate_frozen_operation_mapping(scheduler):
    factory, _ = scheduler
    run(factory)
    with factory() as db:
        db.get(ShopRoutingStageLine, 1).tech_operation_id = 2
        db.commit()
        assert not card_linkage_issues(db, 1)
        start_stage(db, 1, 1)


def test_graph_remove_started_line_rejected_before_mutation(scheduler):
    from app.services.routing_graph_write import save_routing_graph
    from app.schemas.routing_graph import RoutingGraph
    factory, _ = scheduler
    run(factory)
    with factory() as db:
        start_stage(db, 1, 1)
        before = fingerprint(db)
        with pytest.raises(PlanLinkageConflict):
            save_routing_graph(db, 1, RoutingGraph(workshops=(), nodes=(), edges=()))
        assert fingerprint(db) == before


def test_corrupt_plan_is_preserved_by_queue_replay(scheduler):
    from app.services.production_queue_scheduler import schedule_queue
    factory, _ = scheduler
    plan = run(factory)
    with factory() as db:
        row = db.get(CalendarAssignment, plan.steps[0].assignment_id)
        row.stage_result_id = None
        db.commit()
        allocation_ids = list(db.scalars(select(CalendarAllocation.id).where(CalendarAllocation.assignment_id == row.id)))
        result = schedule_queue(db, today=TODAY)
        card = next(item for item in result.results if item.technical_card_id == 1)
        assert card.status == "blocked" and card.preserved
        assert db.get(CalendarAssignment, row.id) is not None
        assert list(db.scalars(select(CalendarAllocation.id).where(CalendarAllocation.assignment_id == row.id))) == allocation_ids


def test_draft_snapshot_reapply_removes_old_plan_and_allocations(scheduler):
    factory, _ = scheduler
    plan = run(factory)
    with factory() as db:
        apply_routing_template(db, 1, 1)
        assert db.get(CalendarAssignment, plan.steps[0].assignment_id) is None
        assert db.scalar(select(CalendarAllocation.id)) is None
        assert db.get(CalendarAssignment, 10) is not None
        assert not card_linkage_issues(db, 1)


def test_allocation_resource_workshop_mismatch_has_exact_mapping(scheduler):
    from app.models.production_capacity import CapacityResource
    factory, _ = scheduler
    run(factory)
    with factory() as db:
        db.add(CapacityResource(resource_key="foreign-resource", name="Foreign", resource_type="throughput",
            capacity_unit="item", calculation_mode="rate", base_rate=100, production_stage_id=2,
            working_days=list(range(7))))
        db.flush()
        db.scalar(select(CalendarAllocation)).resource_key = "foreign-resource"
        db.commit()
        diagnostic = next(d for d in card_linkage_issues(db, 1) if d.code == "calendar_assignment_snapshot_mismatch")
        assert diagnostic.reason == "allocation_resource_workshop_mismatch"
        assert diagnostic.debug_details["actual_mapping"]["resource_key"] == "foreign-resource"
        assert diagnostic.debug_details["allocation_count"] == 1


def test_wrong_snapshot_proposal_cannot_replace_existing_plan(scheduler):
    from app.services.production_scheduler import persist_plan
    factory, _ = scheduler
    run(factory)
    proposal = run(factory, persist=False)
    with factory() as db:
        before = fingerprint(db)
        proposal.steps[0].snapshot_node_id = db.get(TechnicalCard, 2).stage_results[0].id
        with pytest.raises(PlanLinkageConflict):
            persist_plan(db, proposal, {row.id for row in db.scalars(select(CalendarAssignment).where(CalendarAssignment.stage_result_id.is_not(None)))})
        assert fingerprint(db) == before


def test_valid_manual_metadata_change_preserves_node_and_allocations(scheduler):
    factory, _ = scheduler
    plan = run(factory)
    with factory() as db:
        allocation_ids = list(db.scalars(select(CalendarAllocation.id)))
        save(db, AssignmentUpdate(production_stage_id=1, planned_date=TODAY, position=2, note="Updated"), plan.steps[0].assignment_id)
        row = db.get(CalendarAssignment, plan.steps[0].assignment_id)
        assert row.stage_result_id == plan.steps[0].snapshot_node_id and row.note == "Updated"
        assert list(db.scalars(select(CalendarAllocation.id))) == allocation_ids
        assert not card_linkage_issues(db, 1)


def test_low_level_allocation_writer_cannot_allocate_entry_marker(scheduler):
    from app.services.calendar_allocations import add_allocation
    from app.schemas.calendar_allocation import CalendarAllocationCreate
    factory, _ = scheduler
    with factory() as db:
        before = fingerprint(db)
        with pytest.raises(PlanLinkageConflict) as error:
            add_allocation(db, CalendarAllocationCreate(assignment_id=10, resource_key="items", date=TODAY,
                allocated_amount=1, capacity_unit="item"))
        assert error.value.code == "calendar_assignment_missing_snapshot"
        assert fingerprint(db) == before


def test_allocation_cannot_use_work_center_from_another_workshop(scheduler):
    from app.models.production_capacity import CapacityResource
    from app.models.shop_routing import WorkCenter
    from app.services.calendar_allocations import add_allocation
    from app.schemas.calendar_allocation import CalendarAllocationCreate
    factory, _ = scheduler
    plan = run(factory)
    with factory() as db:
        db.add(WorkCenter(id=9, name="Foreign machine", code="foreign", production_stage_id=2))
        db.flush()
        db.add(CapacityResource(resource_key="wrong-machine", name="Wrong", resource_type="machine",
            capacity_unit="item", calculation_mode="rate", base_rate=100, staff_count=null(),
            production_stage_id=1, work_center_id=9, working_days=list(range(7))))
        db.commit()
        before = fingerprint(db)
        with pytest.raises(PlanLinkageConflict) as error:
            add_allocation(db, CalendarAllocationCreate(assignment_id=plan.steps[0].assignment_id,
                resource_key="wrong-machine", date=TODAY, allocated_amount=1, capacity_unit="item"))
        assert error.value.diagnostic.debug_details["actual_mapping"]["work_center_id"] == 9
        assert fingerprint(db) == before
