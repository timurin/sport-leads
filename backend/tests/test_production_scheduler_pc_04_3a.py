from datetime import date, timedelta, datetime, timezone
from decimal import Decimal
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event, select, func
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.deps_auth import get_current_platform_user
from app.database.base import Base
from app.database.session import get_db
from app.main import app
from app.models.auth import PlatformUser
from app.models.rbac import Role, Permission
from app.models.calendar_assignment import CalendarAssignment
from app.models.calendar_allocation import CalendarAllocation
from app.models.production_capacity import CapacityResource, ProductionCapacityException, TechOperationCapacityResource
from app.models.production_stage import ProductionStage
from app.models.shop_routing import ShopRoutingTemplate, ShopRoutingStageLine, WorkCenter
from app.models.tech_operation import TechOperation
from app.models.technical_card import TechnicalCard, TechnicalCardOrderGroup, TechnicalCardStageResult
from app.services.production_scheduler import schedule_card, priority_sort_key
from app.services.route_snapshot import append_snapshot_line, copy_template_snapshot
from app.services.rbac import PERM_TECHNICAL_CARDS_CREATE

TODAY = date(2026, 10, 7)


@pytest.fixture
def scheduler():
    engine = create_engine("sqlite+pysqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    @event.listens_for(engine, "connect")
    def foreign_keys(connection, _):
        connection.execute("PRAGMA foreign_keys=ON")
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, expire_on_commit=False)
    with factory() as db:
        db.add_all([
            ProductionStage(id=1, name="Production", code="production", is_active=True),
            ProductionStage(id=2, name="Packing", code="packaging", is_active=True),
            ProductionStage(id=3, name="Preparation", code="launch_preparation", is_active=True),
            ShopRoutingTemplate(id=1, name="Route", code="route", is_active=True),
            TechOperation(id=1, name="Items", code="items", volume_unit="pieces", production_stage_id=1),
            TechOperation(id=2, name="Next", code="next", volume_unit="pieces", production_stage_id=1),
            TechnicalCardOrderGroup(id=1, order_number="SCHED-ORDER", tech_cards_planned_count=2, desired_date=TODAY + timedelta(days=15)),
        ])
        db.flush()
        db.add_all([
            ShopRoutingStageLine(id=1, routing_template_id=1, stage_order=1, stage_label="Production", production_stage_id=1, tech_operation_id=1),
            CapacityResource(resource_key="items", name="Items", resource_type="throughput", capacity_unit="item", calculation_mode="rate",
                             production_stage_id=1, base_rate=100, staff_count=1, hours_per_day=1, working_days=list(range(7)), shifts_per_day=1, efficiency=1),
            TechnicalCard(id=1, order_group_id=1, card_seq=1, number="SCHED-1", quantity=100, routing_template_id=1,
                          planning_start_date=TODAY, shipping_date=TODAY + timedelta(days=15)),
            TechnicalCard(id=2, order_group_id=1, card_seq=2, number="SCHED-2", quantity=100, routing_template_id=1,
                          planning_start_date=TODAY, shipping_date=TODAY + timedelta(days=15)),
        ])
        db.flush()
        db.add(TechOperationCapacityResource(tech_operation_id=1, resource_key="items"))
        for card in db.scalars(select(TechnicalCard)):
            copy_template_snapshot(db, card)
        db.add(CalendarAssignment(id=10, technical_card_id=1, production_stage_id=3, planned_date=TODAY,
                                  planned_end_date=TODAY, note="Keep entry", position=7, planning_mode="manual_adjusted", manual_lock=True))
        db.commit()
    yield factory, engine
    engine.dispose()


def run(factory, card=1, persist=True):
    with factory() as db:
        return schedule_card(db, card, persist=persist, today=TODAY)


def change(factory, model, key, **fields):
    with factory() as db:
        row = db.get(model, key)
        for field, value in fields.items():
            setattr(row, field, value)
        db.commit()


def add_step(factory):
    with factory() as db:
        line = ShopRoutingStageLine(id=2, routing_template_id=1, stage_order=2, stage_label="Same workshop", production_stage_id=1, tech_operation_id=2)
        db.add(line)
        db.flush()
        db.add(TechOperationCapacityResource(tech_operation_id=2, resource_key="items"))
        for card in db.scalars(select(TechnicalCard)):
            append_snapshot_line(db, card, line)
        db.commit()


def test_one_day_persistence_entry_and_repeat_are_deterministic(scheduler):
    factory, _ = scheduler
    first = run(factory)
    assert first.status == "planned" and first.persisted
    assert first.steps[0].planned_start_date == first.steps[0].planned_end_date == TODAY
    assert first.steps[0].allocations[0].allocated_amount == 100
    assert first.on_time and first.buffer_days == 15 and first.delay_days == 0
    repeated = run(factory)
    assert [(s.planned_start_date, s.planned_end_date, s.allocations) for s in first.steps] == [(s.planned_start_date, s.planned_end_date, s.allocations) for s in repeated.steps]
    with factory() as db:
        assert db.scalar(select(func.count()).select_from(CalendarAllocation)) == 1
        assert db.scalar(select(func.count()).select_from(CalendarAssignment)) == 2
        entry = db.get(CalendarAssignment, 10)
        assert entry.note == "Keep entry" and entry.position == 7 and entry.manual_lock
        row = db.get(CalendarAssignment, repeated.steps[0].assignment_id)
        assert row.planning_mode == "auto" and not row.manual_lock and row.routing_stage_line_id == 1


@pytest.mark.parametrize("field,value,code", [
    ("shipping_date", None, "readiness_not_complete"),
    ("planning_start_date", None, "readiness_not_complete"),
    ("routing_template_id", None, "readiness_not_complete"),
    ("plan_locked", True, "locked_assignment_conflict"),
    ("status", "completed", "readiness_not_complete"),
])
def test_readiness_has_no_new_writes(scheduler, field, value, code):
    factory, _ = scheduler
    change(factory, TechnicalCard, 1, **{field: value})
    result = run(factory)
    assert result.status == "blocked" and result.deviations[0].code == code and not result.steps
    with factory() as db:
        assert db.scalar(select(func.count()).select_from(CalendarAllocation)) == 0


def test_missing_manual_demand_and_links_preserve_existing_auto_plan(scheduler):
    factory, _ = scheduler
    saved = run(factory)
    change(factory, CapacityResource, "items", resource_type="labor", capacity_unit="labor_hour", calculation_mode="explicit_hours", base_rate=None)
    response = run(factory)
    assert response.deviations[0].code == "manual_required"
    with factory() as db:
        assert db.get(CalendarAssignment, saved.steps[0].assignment_id) is not None
        link = db.get(TechOperationCapacityResource, (1, "items"))
        db.delete(link); db.commit()
    assert run(factory).deviations[0].code == "capacity_missing"


def test_multi_day_existing_load_efficiency_working_days_and_exceptions(scheduler):
    factory, _ = scheduler
    change(factory, CapacityResource, "items", efficiency=Decimal("0.5"))
    with factory() as db:
        db.add(ProductionCapacityException(resource_key="items", date=TODAY, unavailable=True))
        db.add(ProductionCapacityException(resource_key="items", date=TODAY + timedelta(days=1), unavailable=False, capacity=30))
        db.commit()
    first = run(factory)
    assert [a.allocated_amount for a in first.steps[0].allocations] == [30, 50, 20]
    assert first.steps[0].planned_end_date == TODAY + timedelta(days=3)
    second = run(factory, 2)
    assert [a.allocated_amount for a in second.steps[0].allocations] == [30, 50, 20]
    assert second.steps[0].planned_start_date == TODAY + timedelta(days=3)
    with factory() as db:
        for day, amount in db.execute(select(CalendarAllocation.date, func.sum(CalendarAllocation.allocated_amount)).group_by(CalendarAllocation.date)):
            capacity = 30 if day == TODAY + timedelta(days=1) else 50
            assert amount <= capacity


def test_weekdays_past_start_horizon_and_atomic_failure(scheduler):
    factory, _ = scheduler
    change(factory, TechnicalCard, 1, planning_start_date=TODAY - timedelta(days=50))
    change(factory, CapacityResource, "items", working_days=[(TODAY.weekday() + 1) % 7])
    assert run(factory).steps[0].planned_start_date == TODAY + timedelta(days=1)
    change(factory, CapacityResource, "items", working_days=[])
    blocked = run(factory)
    assert blocked.status == "blocked" and blocked.deviations[0].code == "no_available_capacity"
    assert blocked.horizon_end == TODAY + timedelta(days=119)
    with factory() as db:
        assert db.scalar(select(func.count()).select_from(CalendarAllocation)) == 1


def test_two_steps_same_workshop_and_shared_resource_use_remaining_day(scheduler):
    factory, _ = scheduler
    change(factory, TechnicalCard, 1, quantity=60)
    add_step(factory)
    result = run(factory)
    assert len(result.steps) == 2
    assert result.steps[1].allocations[0].allocated_amount == 40
    assert result.steps[1].planned_end_date == TODAY + timedelta(days=1)
    assert result.steps[0].routing_stage_line_id != result.steps[1].routing_stage_line_id


def test_multi_resource_concurrent_constraint_and_milestone(scheduler):
    factory, _ = scheduler
    with factory() as db:
        db.add(CapacityResource(resource_key="slow", resource_type="throughput", capacity_unit="item", calculation_mode="rate",
                                production_stage_id=1, base_rate=25, staff_count=1, hours_per_day=1, working_days=list(range(7))))
        db.flush()
        db.add(TechOperationCapacityResource(tech_operation_id=1, resource_key="slow"))
        db.commit()
    result = run(factory)
    assert len(result.steps[0].allocations) == 8
    assert all(a.allocated_amount == 25 for a in result.steps[0].allocations)
    assert result.steps[0].planned_end_date == TODAY + timedelta(days=3)
    change(factory, CapacityResource, "slow", working_days=[])
    assert run(factory).status == "blocked"
    change(factory, CapacityResource, "slow", resource_type="milestone", capacity_unit=None, calculation_mode="milestone", base_rate=None, staff_count=None, hours_per_day=None)
    change(factory, CapacityResource, "items", include_in_calendar_load=False)
    result = run(factory)
    assert result.steps[0].allocations == [] and result.steps[0].planned_start_date == result.steps[0].planned_end_date


@pytest.mark.parametrize("mode", ["manual_adjusted", "locked"])
def test_preserved_manual_anchor_and_conflict(scheduler, mode):
    factory, _ = scheduler
    result = run(factory)
    anchor_id = result.steps[0].assignment_id
    change(factory, CalendarAssignment, anchor_id, planning_mode=mode, manual_lock=True, note="Owner anchor")
    add_step(factory)
    next_plan = run(factory)
    assert next_plan.status == "planned" and next_plan.steps[0].preserved
    assert next_plan.steps[0].assignment_id == anchor_id
    change(factory, TechnicalCard, 1, quantity=200)
    failed = run(factory)
    assert failed.deviations[0].code == "locked_assignment_conflict"
    with factory() as db:
        assert db.get(CalendarAssignment, anchor_id).note == "Owner anchor"
        assert db.scalar(select(func.count()).select_from(CalendarAllocation)) == 2


def test_fact_protection_and_dry_run_no_writes(scheduler):
    factory, engine = scheduler
    writes = []
    def track(_, __, sql, ___, ____, _____):
        if sql.lstrip().split()[0] in {"INSERT", "UPDATE", "DELETE"}:
            writes.append(sql)
    event.listen(engine, "before_cursor_execute", track)
    try:
        dry = run(factory, persist=False)
        assert dry.status == "planned" and not dry.persisted and not writes
    finally:
        event.remove(engine, "before_cursor_execute", track)
    with factory() as db:
        fact = db.scalar(select(TechnicalCardStageResult).where(TechnicalCardStageResult.technical_card_id == 1, TechnicalCardStageResult.stage_order == 1))
        fact.status = "in_progress"
        db.commit()
    assert run(factory).deviations[0].reason == "started_step_without_saved_plan"


def test_failure_in_later_step_leaves_original_plan_untouched(scheduler):
    factory, _ = scheduler
    original = run(factory)
    add_step(factory)
    change(factory, TechOperation, 2, is_active=False)
    assert run(factory).status == "blocked"
    with factory() as db:
        assert db.get(CalendarAssignment, original.steps[0].assignment_id) is not None
        assert db.scalar(select(func.count()).select_from(CalendarAllocation)) == 1


def test_commit_failure_rolls_back_replacement(scheduler):
    factory, engine = scheduler
    original = run(factory)
    def fail(_, __, sql, ___, ____, _____):
        if sql.startswith("INSERT INTO calendar_allocations"):
            raise RuntimeError("Injected persistence failure")
    event.listen(engine, "before_cursor_execute", fail)
    try:
        with pytest.raises(RuntimeError, match="Injected"):
            run(factory)
    finally:
        event.remove(engine, "before_cursor_execute", fail)
    with factory() as db:
        assert db.get(CalendarAssignment, original.steps[0].assignment_id) is not None
        assert db.scalar(select(func.count()).select_from(CalendarAllocation)) == 1


def test_deadline_missed_is_saved_and_rounding_never_loses_work(scheduler):
    factory, _ = scheduler
    change(factory, TechnicalCard, 1, quantity=Decimal("100.001"), shipping_date=TODAY)
    result = run(factory)
    assert result.persisted and not result.on_time and result.delay_days == 1 and result.buffer_days == -1
    assert result.deviations[0].code == "deadline_missed"
    assert sum(a.allocated_amount for a in result.steps[0].allocations) == Decimal("100.001")


def test_endpoint_permissions_and_not_found(scheduler):
    factory, _ = scheduler
    original = dict(app.dependency_overrides)
    def override():
        with factory() as db:
            yield db
    user = PlatformUser(id=9, login="scheduler", roles=[Role(code="planner", name="Planner", permissions=[Permission(code=PERM_TECHNICAL_CARDS_CREATE)])])
    app.dependency_overrides[get_db] = override
    try:
        with TestClient(app) as client:
            assert client.post("/technical-cards/1/schedule").status_code == 401
            app.dependency_overrides[get_current_platform_user] = lambda: user
            assert client.post("/technical-cards/999/schedule").status_code == 404
            assert client.post("/technical-cards/1/schedule").json()["persisted"] is True
            user.roles = []
            assert client.post("/technical-cards/1/schedule").status_code == 403
    finally:
        app.dependency_overrides.clear(); app.dependency_overrides.update(original)


def test_priority_ordering_contract():
    def card(id, priority):
        return SimpleNamespace(id=id, priority=priority, shipping_date=TODAY, planning_start_date=TODAY,
                               created_at=datetime(2026, 10, 1, tzinfo=timezone.utc))
    assert [c.id for c in sorted([card(1, None), card(2, 0), card(3, 4), card(4, None)], key=priority_sort_key)] == [2, 3, 1, 4]


def test_historical_auto_and_completed_fact_are_not_replaced(scheduler):
    factory, _ = scheduler
    planned = run(factory)
    anchor = planned.steps[0].assignment_id
    with factory() as db:
        row = db.get(CalendarAssignment, anchor)
        row.planned_date = row.planned_end_date = TODAY - timedelta(days=1)
        allocation = db.scalar(select(CalendarAllocation).where(CalendarAllocation.assignment_id == anchor))
        allocation.date = row.planned_date
        fact = db.scalar(select(TechnicalCardStageResult).where(TechnicalCardStageResult.technical_card_id == 1, TechnicalCardStageResult.stage_order == 1))
        fact.status = "completed"
        db.commit()
    add_step(factory)
    result = run(factory)
    assert result.status == "planned" and result.steps[0].assignment_id == anchor and result.steps[0].preserved
    assert result.steps[1].planned_start_date >= TODAY
    with factory() as db:
        assert db.get(CalendarAssignment, anchor).planned_date == TODAY - timedelta(days=1)


def test_missing_capacity_after_first_step_is_atomic(scheduler):
    factory, _ = scheduler
    original = run(factory)
    add_step(factory)
    with factory() as db:
        db.add(CapacityResource(resource_key="unconfigured", resource_type="throughput", capacity_unit="item", calculation_mode="rate",
                               production_stage_id=1, staff_count=1, base_rate=100, hours_per_day=None, working_days=list(range(7))))
        db.flush()
        db.get(TechOperationCapacityResource, (2, "items")).resource_key = "unconfigured"
        db.commit()
    result = run(factory)
    assert result.status == "blocked" and not result.steps and result.deviations[0].code == "capacity_missing"
    with factory() as db:
        assert db.get(CalendarAssignment, original.steps[0].assignment_id) is not None


def test_fractional_daily_capacity_is_floored_without_overflow(scheduler):
    factory, _ = scheduler
    change(factory, CapacityResource, "items", base_rate=Decimal("1.0001"), hours_per_day=Decimal("0.3333"))
    change(factory, TechnicalCard, 1, quantity=Decimal("1.001"))
    result = run(factory)
    assert result.status == "planned"
    allocations = result.steps[0].allocations
    assert sum(a.allocated_amount for a in allocations) == Decimal("1.001")
    assert all(a.allocated_amount <= Decimal("0.33333333") for a in allocations)


def test_real_sewing_demand_quantization_rounds_up_only(scheduler):
    factory, _ = scheduler
    from app.models.product_model import ProductModel, AssemblyVariant, AssemblyOperationLine
    from app.models.technical_card import TechnicalCardOperationLine
    with factory() as db:
        db.add(ProductModel(id=1, article="SCHED-MODEL", name="Model", size_type="men")); db.flush()
        db.add(AssemblyVariant(id=1, product_model_id=1, name="Variant")); db.flush()
        db.add(AssemblyOperationLine(assembly_variant_id=1, sequence=1, operation_name="Stitch", duration_seconds=1, quantity_per_item=1))
        db.add(TechnicalCardOperationLine(technical_card_id=1, sequence=1, source_kind="sewing", operation_name="Stitch",
                                         volume_unit="pieces", volume=0, stage_order=1, production_stage_id=1))
        db.get(TechnicalCard, 1).product_model_id = 1
        db.get(TechnicalCard, 1).assembly_variant_id = 1
        row = db.get(CapacityResource, "items")
        row.resource_type, row.capacity_unit, row.calculation_mode, row.base_rate = "labor", "labor_hour", "sewing_norm", None
        db.commit()
    result = run(factory)
    assert result.steps[0].allocations[0].allocated_amount == Decimal("0.0278")
    assert result.steps[0].allocations[0].allocated_amount >= Decimal(100) / 3600


def test_cutting_methods_share_day_without_inventing_mixed_productivity(scheduler):
    factory, _ = scheduler
    from app.models.technical_card import TechnicalCardOperationLine
    with factory() as db:
        db.get(TechOperation, 1).code = "manual-cut"
        row = db.get(CapacityResource, "items")
        row.resource_type, row.capacity_unit, row.calculation_mode, row.base_rate = "labor", "item", "cutting_methods", None
        row.norm_rates = {"manual_single_items_per_person_hour": "20", "manual_lay_items_per_person_hour": "40"}
        for card_id, method in [(1, "manual_single"), (2, "manual_lay")]:
            db.get(TechnicalCard, card_id).quantity = 10
            db.add(TechnicalCardOperationLine(technical_card_id=card_id, sequence=1, source_kind="routing", operation_name="Manual cut",
                                             tech_operation_id=1, volume_unit="pieces", volume=0, stage_order=1, production_stage_id=1, cutting_method=method))
        db.commit()
    first, second = run(factory), run(factory, 2)
    assert first.steps[0].planned_start_date == TODAY
    assert second.steps[0].planned_start_date == TODAY + timedelta(days=1)
