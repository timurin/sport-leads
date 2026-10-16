import pytest
from sqlalchemy import select
from tests.test_production_scheduler_pc_04_3a import scheduler, run
from tests.test_route_reapply_ic_g01 import fingerprint
from tests.test_work_center_scheduler_pc_04_4d import plotters
from app.models.audit import AuditEvent
from app.models.calendar_assignment import CalendarAssignment
from app.models.calendar_allocation import CalendarAllocation
from app.models.technical_card import TechnicalCard
from app.models.production_capacity import CapacityResource
from app.services.calendar_plan_freshness import CODE, stale_issue, card_stale_issues, saved_stamp
from app.services.calendar_plan_linkage import PlanLinkageConflict
from app.services.technical_card_stages import start_stage, complete_stage


def test_unchanged_inputs_and_metadata_keep_plan_fresh(scheduler):
    factory, _ = scheduler
    plan = run(factory)
    with factory() as db:
        assignment = db.get(CalendarAssignment, plan.steps[0].assignment_id)
        assert saved_stamp(db, assignment)["fingerprint"] and not stale_issue(db, assignment)
        db.get(TechnicalCard, 1).nomenclature_name = "Display change"
        db.commit()
        assert not stale_issue(db, assignment)
        start_stage(db, 1, 1)


def test_quantity_change_is_stale_start_rejects_and_replan_clears(scheduler):
    factory, _ = scheduler
    plan = run(factory)
    with factory() as db:
        db.get(TechnicalCard, 1).quantity = 150
        db.commit()
        issue = stale_issue(db, db.get(CalendarAssignment, plan.steps[0].assignment_id))
        assert issue.code == CODE and issue.debug_details["changed_inputs"] == ["quantity"]
        assert issue.debug_details["previous_inputs"]["quantity"] == "100"
        assert issue.debug_details["current_inputs"]["quantity"] == "150"
        with pytest.raises(PlanLinkageConflict): start_stage(db, 1, 1)
    replacement = run(factory)
    with factory() as db:
        assert not card_stale_issues(db, 1)
        assert sum(db.scalars(select(CalendarAllocation.allocated_amount))) == 150
        assert db.scalar(select(AuditEvent.id).where(AuditEvent.action == "calendar.assignment_replanned"))
        start_stage(db, 1, 1)


@pytest.mark.parametrize("status", ["in_progress", "completed"])
@pytest.mark.parametrize("input_name", ["quantity", "capacity"])
def test_confirmed_fact_inputs_reject_atomically_without_historical_replan(scheduler, status, input_name):
    factory, _ = scheduler
    run(factory)
    with factory() as db:
        start_stage(db, 1, 1)
        if status == "completed": complete_stage(db, 1, 1)
        before = fingerprint(db)
        if input_name == "quantity": db.get(TechnicalCard, 1).quantity = 150
        else: db.get(CapacityResource, "items").hours_per_day = 2
        with pytest.raises(PlanLinkageConflict) as error:
            db.commit()
        assert error.value.code == CODE and error.value.category == "INTEGRITY"
        db.rollback()
        assert fingerprint(db) == before and not card_stale_issues(db, 1)


def test_eta_capacity_change_detected_even_when_demand_amount_is_unchanged(scheduler):
    factory, _ = scheduler
    plan = run(factory)
    with factory() as db:
        db.get(CapacityResource, "items").base_rate = 50
        db.commit()
        issue = stale_issue(db, db.get(CalendarAssignment, plan.steps[0].assignment_id))
        assert issue.debug_details["changed_inputs"] == ["capacity"]
        assert issue.debug_details["old_demand"] == issue.debug_details["current_demand"]
    run(factory)
    with factory() as db: assert not card_stale_issues(db, 1)


def test_route_reapply_retires_future_plan_and_requires_new_generation(scheduler):
    from app.models.shop_routing import ShopRoutingStageLine
    from app.services.technical_cards import apply_routing_template
    factory, _ = scheduler
    run(factory)
    with factory() as db:
        db.get(ShopRoutingStageLine, 1).stage_label = "Applied future version"
        db.commit()
        assert not card_stale_issues(db, 1)  # Live master is not the applied Demand.
        apply_routing_template(db, 1, 1)
        assert card_stale_issues(db, 1)[0].debug_details["replan_required"]
    run(factory)
    with factory() as db: assert not card_stale_issues(db, 1)


def test_one_of_change_without_replan_requires_new_saved_generation(scheduler):
    from tests.test_route_variants_pc_04_4i import seed_variant, patch
    factory, _ = scheduler
    nodes = seed_variant(factory)
    run(factory, card=3)
    patch(factory, nodes[4], replan=False)
    with factory() as db: assert any(d.code == CODE for d in card_stale_issues(db, 3))
    run(factory, card=3)
    with factory() as db: assert not card_stale_issues(db, 3)


def test_missing_legacy_stamp_is_unverifiable_not_guessed(scheduler):
    factory, _ = scheduler
    plan = run(factory)
    with factory() as db:
        event = db.scalar(select(AuditEvent).where(AuditEvent.action == "calendar.assignment_created", AuditEvent.entity_id == "1"))
        event.payload = {key:value for key,value in event.payload.items() if key != "demand_input_snapshot"}
        db.commit()
        issue = stale_issue(db, db.get(CalendarAssignment, plan.steps[0].assignment_id))
        assert issue.reason == "legacy_inputs_unverifiable" and issue.debug_details["old_demand"] is None
        assert issue.debug_details["changed_inputs"] == []
    run(factory)
    with factory() as db: assert not card_stale_issues(db, 1)


def test_manual_meter_volume_change_is_a_consumed_input(plotters):
    from app.models.technical_card import TechnicalCardOperationLine
    plan = run(plotters)
    with plotters() as db:
        row = db.scalar(select(TechnicalCardOperationLine).where(TechnicalCardOperationLine.technical_card_id == 1))
        row.volume = 120
        db.commit()
        issue = stale_issue(db, db.get(CalendarAssignment, plan.steps[0].assignment_id))
        assert "operation_volumes" in issue.debug_details["changed_inputs"]


@pytest.mark.parametrize("confirmed", [False, True])
def test_live_sewing_duration_and_multiplicity_invalidate_future_plan(plotters, confirmed):
    from app.models.product_model import ProductModel, AssemblyVariant, AssemblyOperationLine
    from app.models.technical_card import TechnicalCardOperationLine
    from app.models.production_capacity import TechOperationCapacityResource
    with plotters() as db:
        db.add(ProductModel(id=1, article="FRESH", name="Fixture", size_type="men"))
        db.flush()
        db.add(AssemblyVariant(id=1, product_model_id=1, name="Fixture assembly"))
        db.flush()
        db.add(AssemblyOperationLine(assembly_variant_id=1, sequence=1, operation_name="Time", duration_seconds=36, quantity_per_item=1))
        db.add(TechnicalCardOperationLine(technical_card_id=1, sequence=2, source_kind="sewing", operation_name="Time",
            volume_unit="pieces", volume=0, production_stage_id=1, stage_order=1))
        card = db.get(TechnicalCard, 1)
        card.product_model_id, card.assembly_variant_id = 1, 1
        db.add(CapacityResource(resource_key="test-labor", resource_type="labor", capacity_unit="labor_hour", calculation_mode="sewing_norm",
            staff_count=1, hours_per_day=1, working_days=list(range(7)), production_stage_id=1))
        db.flush()
        db.add(TechOperationCapacityResource(tech_operation_id=1, resource_key="test-labor"))
        db.commit()
    plan = run(plotters)
    with plotters() as db:
        if confirmed:
            start_stage(db, 1, 1)
            before = fingerprint(db)
        norm = db.scalar(select(AssemblyOperationLine))
        norm.duration_seconds, norm.quantity_per_item = 72, 2
        if confirmed:
            with pytest.raises(PlanLinkageConflict): db.commit()
            db.rollback()
            assert fingerprint(db) == before and not card_stale_issues(db, 1)
            return
        db.commit()
        issue = stale_issue(db, db.get(CalendarAssignment, plan.steps[0].assignment_id))
        assert "sewing" in issue.debug_details["changed_inputs"]
    run(plotters)
    with plotters() as db: assert not card_stale_issues(db, 1)


@pytest.mark.parametrize("confirmed", [False, True])
def test_explicit_operation_norm_revision_requires_replan_or_rejects_fact(scheduler, confirmed):
    from decimal import Decimal
    from tests.test_production_diagnostics_pc_04_4m import preprint
    from app.schemas.tech_operation import TechOperationUpdate
    from app.services.tech_operations import update_tech_operation
    factory, _ = scheduler
    preprint(factory)
    with factory() as db:
        update_tech_operation(db, 2, TechOperationUpdate(demand_rule="per_item", demand_duration_seconds=18))
    plan = run(factory)
    with factory() as db:
        if confirmed:
            start_stage(db, 1, 1)
            complete_stage(db, 1, 1)
            start_stage(db, 1, 2)
            before = fingerprint(db)
            with pytest.raises(PlanLinkageConflict):
                update_tech_operation(db, 2, TechOperationUpdate(demand_duration_seconds=36))
            db.rollback()
            assert fingerprint(db) == before
            return
        update_tech_operation(db, 2, TechOperationUpdate(demand_duration_seconds=36))
        issue = stale_issue(db, db.get(CalendarAssignment, plan.steps[1].assignment_id))
        assert issue.debug_details["changed_inputs"] == ["operation_rule"]
        assert issue.debug_details["old_demand"][0]["amount"] == "0.5"
        assert issue.debug_details["current_demand"][0]["amount"] == "1"
    run(factory)
    with factory() as db:
        assert not card_stale_issues(db, 1)
        assert sum(db.scalars(select(CalendarAllocation.allocated_amount).where(CalendarAllocation.resource_key == "operator"))) == Decimal("1")
