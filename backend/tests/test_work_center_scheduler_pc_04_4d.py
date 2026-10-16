from datetime import timedelta
from decimal import Decimal

import pytest
from sqlalchemy import func, select

from tests.test_production_scheduler_pc_04_3a import TODAY, scheduler, change, run
from tests.test_scheduler_scenarios_pc_04_3c import scenario_api
from app.models.calendar_allocation import CalendarAllocation
from app.models.calendar_assignment import CalendarAssignment
from app.models.production_capacity import CapacityResource, ProductionCapacityException, TechOperationCapacityResource
from app.models.shop_routing import WorkCenter
from app.models.tech_operation import TechOperation
from app.models.technical_card import TechnicalCard, TechnicalCardOperationLine
from app.schemas.shop_routing import WorkCenterUpdate
from app.services.production_queue_scheduler import schedule_queue
from app.services.route_snapshot import copy_template_snapshot
from app.services.shop_routings import update_work_center, delete_work_center, WorkCenterValidationError, WorkCenterConflictError


@pytest.fixture
def plotters(scheduler):
    factory, _ = scheduler
    with factory() as db:
        db.get(TechOperation, 1).volume_unit = "linear_meters"
        db.delete(db.get(TechOperationCapacityResource, (1, "items")))
        for index, rate in enumerate([15, 20, 10, 30], 1):
            db.add(WorkCenter(id=index, name=f"Plotter {index}", code=f"P{index}", production_stage_id=1))
            db.flush()
            db.add(CapacityResource(resource_key=f"plotter-test-{index}", name=f"Plotter {index}", resource_type="machine",
                                   capacity_unit="linear_meter", calculation_mode="rate", base_rate=rate,
                                   work_center_id=index, production_stage_id=1, hours_per_day=10,
                                   shifts_per_day=1, efficiency=1, working_days=list(range(7)), staff_count=None))
            db.flush()
            db.add(TechOperationCapacityResource(tech_operation_id=1, resource_key=f"plotter-test-{index}"))
        for card_id in range(1, 7):
            if card_id > 2:
                card = TechnicalCard(id=card_id, order_group_id=1, card_seq=card_id, number=f"PLOTTER-{card_id}", quantity=100,
                                     routing_template_id=1, planning_start_date=TODAY, shipping_date=TODAY + timedelta(days=15))
                db.add(card)
                db.flush()
                copy_template_snapshot(db, card)
            db.add(TechnicalCardOperationLine(technical_card_id=card_id, sequence=1, source_kind="routing", tech_operation_id=1,
                                             operation_name="Print", volume_unit="linear_meters", volume=100,
                                             stage_order=1, production_stage_id=1))
        db.add(ProductionCapacityException(resource_key="plotter-test-4", date=TODAY, unavailable=True))
        db.commit()
    return factory


def test_four_individual_plotters_choose_concrete_free_machine(plotters):
    factory = plotters
    with factory() as db:
        result = schedule_queue(db, today=TODAY)
        assert result.planned_cards == 6
    selected = set()
    with factory() as db:
        limits = {f"plotter-test-{index}": Decimal(rate * 10) for index, rate in enumerate([15, 20, 10, 30], 1)}
        for key, day, amount in db.execute(select(CalendarAllocation.resource_key, CalendarAllocation.date,
                                                func.sum(CalendarAllocation.allocated_amount)).group_by(CalendarAllocation.resource_key, CalendarAllocation.date)):
            assert amount <= limits[key]
            assert key != "plotter-test-4" or day != TODAY
        for card_id in range(1, 7):
            rows = list(db.execute(select(CalendarAllocation, CapacityResource.work_center_id)
                                  .join(CapacityResource, CalendarAllocation.resource_key == CapacityResource.resource_key)
                                  .join(CalendarAssignment, CalendarAllocation.assignment_id == CalendarAssignment.id)
                                  .where(CalendarAssignment.technical_card_id == card_id)))
            assert sum(row.allocated_amount for row, _ in rows) == 100
            assert len({center for _, center in rows}) == 1
            selected.update(center for _, center in rows)
        assert len(selected) >= 2
        repeated = schedule_queue(db, today=TODAY)
        assert repeated.model_dump() == result.model_dump()


@pytest.mark.parametrize("field,value", [("is_active", False), ("production_stage_id", 2)])
def test_inactive_and_foreign_workshop_machine_ignored(plotters, field, value):
    change(plotters, WorkCenter, 1, **{field: value})
    result = run(plotters)
    assert result.status == "planned"
    assert all(a.work_center_id != 1 for a in result.steps[0].allocations)
    assert {a.work_center_id for a in result.steps[0].allocations} == {2}


def test_unknown_rate_calendar_candidate_does_not_hide_other_machines(plotters):
    change(plotters, CapacityResource, "plotter-test-1", hours_per_day=None)
    result = run(plotters)
    assert result.status == "planned" and result.steps[0].allocations[0].work_center_id == 2
    for center in range(1, 5):
        change(plotters, WorkCenter, center, is_active=False)
    assert run(plotters).deviations[0].reason == "no_compatible_active_machine"


def test_operator_remains_separate_mandatory_constraint(plotters):
    with plotters() as db:
        db.add(CapacityResource(resource_key="print_operator", resource_type="labor", capacity_unit="labor_hour",
                               calculation_mode="explicit_hours", production_stage_id=1, staff_count=1,
                               hours_per_day=8, working_days=list(range(7))))
        db.flush()
        db.add(TechOperationCapacityResource(tech_operation_id=1, resource_key="print_operator"))
        db.commit()
    result = run(plotters)
    assert result.status == "blocked" and result.deviations[0].code == "manual_required"
    assert result.deviations[0].resource_key == "print_operator"


def test_preserved_anchor_keeps_selected_machine(plotters):
    saved = run(plotters)
    assignment = saved.steps[0].assignment_id
    change(plotters, CalendarAssignment, assignment, planning_mode="locked", manual_lock=True)
    result = run(plotters)
    assert result.status == "planned" and result.steps[0].preserved
    assert result.steps[0].allocations == saved.steps[0].allocations


def test_allocation_identity_cannot_be_rebound(plotters):
    from app.services.capacity_resources import save_resource
    from app.services.work_center_capacity import allocations, read_capacity, day_load
    from app.schemas.production_capacity import CapacityResourceWrite
    from app.services.production_calendar import CalendarError
    saved = run(plotters)
    key = saved.steps[0].allocations[0].resource_key
    with plotters() as db:
        row = read_capacity(db, 1)
        assert row.key == key
        assert allocations(db, 1, TODAY, TODAY)[0].work_center_id == 1
        load = day_load(db, 1, TODAY)
        assert load.configured_capacity == 150 and load.allocated == 100 and load.remaining == 50
        payload = row.model_dump(exclude={"key", "exceptions"})
        payload["work_center_id"] = 2
        from app.services.calendar_plan_linkage import PlanLinkageConflict
        with pytest.raises(PlanLinkageConflict) as error:
            save_resource(db, key, CapacityResourceWrite(**payload))
        assert error.value.code == "calendar_allocation_resource_mismatch"
        with pytest.raises(WorkCenterConflictError):
            delete_work_center(db, 1)


def test_machine_and_labor_are_constrained_together_without_fake_operator_norm(plotters):
    # Use the existing verified sewing-time adapter as a test labor demand.
    # No new print-operator norma is inferred or added by this task.
    from app.models.product_model import ProductModel, AssemblyVariant, AssemblyOperationLine
    with plotters() as db:
        db.add(ProductModel(id=1, name="Fixture", article="WC-LABOR", size_type="men")); db.flush()
        db.add(AssemblyVariant(id=1, product_model_id=1, name="Fixture assembly")); db.flush()
        db.add(AssemblyOperationLine(assembly_variant_id=1, sequence=1, operation_name="Time", duration_seconds=36, quantity_per_item=1))
        db.add(TechnicalCardOperationLine(technical_card_id=1, sequence=2, source_kind="sewing", operation_name="Time", volume_unit="pieces", volume=0, production_stage_id=1, stage_order=1))
        card = db.get(TechnicalCard, 1)
        card.product_model_id, card.assembly_variant_id = 1, 1
        db.add(CapacityResource(resource_key="test-labor", resource_type="labor", capacity_unit="labor_hour", calculation_mode="sewing_norm",
                               staff_count=1, hours_per_day=Decimal("0.5"), working_days=list(range(7)), production_stage_id=1))
        db.flush()
        db.add(TechOperationCapacityResource(tech_operation_id=1, resource_key="test-labor"))
        db.commit()
    result = run(plotters)
    assert result.status == "planned" and result.steps[0].planned_end_date == TODAY + timedelta(days=1)
    amounts = result.steps[0].allocations
    assert sum(a.allocated_amount for a in amounts if a.resource_key == "test-labor") == 1
    assert sum(a.allocated_amount for a in amounts if a.work_center_id is not None) == 100
    assert all(a.work_center_id is None for a in amounts if a.resource_key == "test-labor")


def test_work_center_capacity_api_is_one_store(scenario_api):
    factory, client = scenario_api
    with factory() as db:
        db.add(WorkCenter(id=1, name="Plotter", code="P1", production_stage_id=1))
        db.commit()
    body = dict(capacity_unit="linear_meter", base_rate="15", hours_per_day="10", shifts_per_day=1,
                efficiency="1", working_days=[0, 1, 2, 3, 4])
    first = client.put("/work-centers/1/capacity", json=body)
    assert first.status_code == 200, first.text
    assert first.json()["key"] == "work_center_1" and first.json()["resource_count"] is None
    body["base_rate"] = "20"
    assert client.put("/work-centers/1/capacity", json=body).status_code == 200
    assert client.get("/work-centers/1/capacity").json()["base_rate"] == "20.0000"
    assert client.put(f"/work-centers/1/capacity/exceptions/{TODAY}", json={"unavailable": True}).status_code == 200
    assert client.get("/work-centers/1/capacity").json()["exceptions"][0]["unavailable"]
    with factory() as db:
        assert db.scalar(select(func.count()).select_from(CapacityResource).where(CapacityResource.work_center_id == 1)) == 1
    assert client.put("/work-centers/1/capacity", json={**body, "base_rate": 0}).status_code == 422
    assert client.put("/work-centers/1/capacity", json={**body, "base_rate": "1.00001"}).status_code == 422
    assert client.put("/work-centers/1/capacity", json={**body, "resource_count": 4}).status_code == 422
    assert client.put("/work-centers/1/capacity", json={**body, "hours_per_day": 20, "shifts_per_day": 2}).status_code == 422
    assert client.get(f"/work-centers/1/allocations?from={TODAY}&to={TODAY}").json() == []
    with factory() as db:
        with pytest.raises(WorkCenterValidationError):
            update_work_center(db, 1, WorkCenterUpdate(production_stage_id=2))
        # Existing catalog deletion stays allowed before any allocations exist.
        delete_work_center(db, 1)
