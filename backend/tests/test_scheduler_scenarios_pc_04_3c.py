"""HTTP -> real Demand -> scheduler -> persisted calendar scenario evidence.

All data lives in the SQLite fixture from PC-04.3A. Only the clock and auth/DB
dependencies are controlled; no Demand or capacity result is mocked.
"""
import json
from collections import defaultdict
from datetime import timedelta
from decimal import Decimal, ROUND_CEILING

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from tests.test_production_scheduler_pc_04_3a import TODAY, scheduler, change, add_step
from app.api.deps_auth import get_current_platform_user
from app.database.session import get_db
from app.main import app
from app.models.auth import PlatformUser
from app.models.rbac import Role, Permission
from app.models.calendar_assignment import CalendarAssignment
from app.models.calendar_allocation import CalendarAllocation
from app.models.production_capacity import CapacityResource, ProductionCapacityException, TechOperationCapacityResource
from app.models.shop_routing import ShopRoutingStageLine
from app.models.tech_operation import TechOperation
from app.models.technical_card import TechnicalCard, TechnicalCardOperationLine
from app.services.production_demand import read_technical_card_demand
from app.services.production_scheduler import schedule_card
from app.services.rbac import PERM_TECHNICAL_CARDS_CREATE


@pytest.fixture
def scenario_api(scheduler, monkeypatch):
    factory, _ = scheduler
    from app.api import technical_cards
    monkeypatch.setattr(technical_cards, "schedule_card", lambda db, card_id: schedule_card(db, card_id, today=TODAY))
    previous = dict(app.dependency_overrides)
    def database():
        with factory() as db:
            yield db
    user = PlatformUser(id=90, login="scenario-planner", roles=[Role(code="planner", name="Planner", permissions=[Permission(code=PERM_TECHNICAL_CARDS_CREATE)])])
    app.dependency_overrides[get_db] = database
    app.dependency_overrides[get_current_platform_user] = lambda: user
    try:
        with TestClient(app) as client:
            yield factory, client
    finally:
        app.dependency_overrides.clear()
        app.dependency_overrides.update(previous)


def post(client, card=1):
    response = client.post(f"/technical-cards/{card}/schedule")
    assert response.status_code == 200, response.text
    body = response.json()
    assert set(body) == {"technical_card_id", "status", "persisted", "planning_from", "horizon_end", "planned_completion_date", "on_time", "buffer_days", "delay_days", "steps", "deviations"}
    return body


def snapshot(factory):
    with factory() as db:
        return (
            [(r.id, r.technical_card_id, r.routing_stage_line_id, r.planned_date, r.planned_end_date, r.planning_mode, r.manual_lock, r.note, r.position) for r in db.scalars(select(CalendarAssignment).order_by(CalendarAssignment.id))],
            [(r.id, r.assignment_id, r.resource_key, r.date, r.allocated_amount, r.capacity_unit) for r in db.scalars(select(CalendarAllocation).order_by(CalendarAllocation.id))],
        )


def verify_saved(factory, body, capacities):
    """Compare stored rows to real Demand and independently supplied capacity budgets."""
    assert body["status"] == "planned" and body["persisted"] is True
    with factory() as db:
        demand = read_technical_card_demand(db, body["technical_card_id"])
        expected = {s.routing_stage_line_id: {d.resource_key: (Decimal(d.amount).quantize(Decimal("0.0001"), rounding=ROUND_CEILING), d.unit) for d in s.demands if d.status == "ready"} for s in demand.steps}
        previous_end = None
        for step in body["steps"]:
            row = db.get(CalendarAssignment, step["assignment_id"])
            assert row.technical_card_id == body["technical_card_id"]
            assert row.routing_stage_line_id == step["routing_stage_line_id"]
            assert row.planned_date.isoformat() == step["planned_start_date"]
            assert row.planned_end_date.isoformat() == step["planned_end_date"]
            if not step["preserved"]:
                assert row.planning_mode == "auto" and not row.manual_lock
            if previous_end is not None:
                assert row.planned_date >= previous_end
            previous_end = row.planned_end_date
            allocations = list(db.scalars(select(CalendarAllocation).where(CalendarAllocation.assignment_id == row.id)))
            assert row.planned_date == min(a.date for a in allocations)
            assert row.planned_end_date == max(a.date for a in allocations)
            totals = defaultdict(Decimal)
            for allocation in allocations:
                totals[allocation.resource_key] += allocation.allocated_amount
                assert allocation.capacity_unit == expected[row.routing_stage_line_id][allocation.resource_key][1]
            assert dict(totals) == {key: value[0] for key, value in expected[row.routing_stage_line_id].items()}
            assert sorted((a.resource_key, a.date.isoformat(), a.allocated_amount, a.capacity_unit) for a in allocations) == sorted((a["resource_key"], a["date"], Decimal(a["allocated_amount"]), a["capacity_unit"]) for a in step["allocations"])
        assert body["planned_completion_date"] == previous_end.isoformat()
        # Includes other cards and preserved rows, not only this response.
        daily = defaultdict(Decimal)
        tokens = set()
        for allocation in db.scalars(select(CalendarAllocation)):
            token = (allocation.assignment_id, allocation.resource_key, allocation.date)
            assert token not in tokens
            tokens.add(token)
            daily[(allocation.resource_key, allocation.date)] += allocation.allocated_amount
        for (key, day), amount in daily.items():
            budget = capacities[key]
            assert amount <= (budget(day) if callable(budget) else Decimal(budget))
        rows = list(db.scalars(select(CalendarAssignment).where(CalendarAssignment.routing_stage_line_id.is_not(None))))
        assert len(rows) == len({(r.technical_card_id, r.routing_stage_line_id) for r in rows})
        entry = db.get(CalendarAssignment, 10)
        assert entry.note == "Keep entry" and entry.position == 7 and entry.manual_lock
        assert not list(db.scalars(select(CalendarAllocation).where(CalendarAllocation.assignment_id == 10)))


def test_a_one_day_response_and_persistence(scenario_api):
    factory, client = scenario_api
    body = post(client)
    verify_saved(factory, body, {"items": 100})
    assert body["steps"][0]["planned_start_date"] == body["steps"][0]["planned_end_date"] == TODAY.isoformat()
    assert body["on_time"] is True and body["buffer_days"] == 15 and body["delay_days"] == 0
    print("SCENARIO_A_RESPONSE=" + json.dumps(body))


def test_b_multi_day_weekend_span(scenario_api):
    factory, client = scenario_api
    change(factory, TechnicalCard, 1, quantity=250, planning_start_date=TODAY + timedelta(days=2))
    change(factory, CapacityResource, "items", working_days=[0, 1, 2, 3, 4])
    body = post(client)
    verify_saved(factory, body, {"items": lambda day: 100 if day.weekday() < 5 else 0})
    allocations = body["steps"][0]["allocations"]
    assert [(a["date"], Decimal(a["allocated_amount"])) for a in allocations] == [("2026-10-09", 100), ("2026-10-12", 100), ("2026-10-13", 50)]


def test_c_three_sequential_steps(scenario_api):
    factory, client = scenario_api
    change(factory, TechnicalCard, 1, quantity=150)
    add_step(factory)
    with factory() as db:
        db.add(TechOperation(id=4, name="Third", code="third", volume_unit="pieces", production_stage_id=1))
        db.flush()
        line = ShopRoutingStageLine(id=4, routing_template_id=1, stage_order=3, stage_label="Third", production_stage_id=1, tech_operation_id=4)
        db.add(line)
        db.flush()
        db.add(TechOperationCapacityResource(tech_operation_id=4, resource_key="items"))
        from app.services.route_snapshot import append_snapshot_line
        append_snapshot_line(db, db.get(TechnicalCard, 1), line)
        db.commit()
    body = post(client)
    verify_saved(factory, body, {"items": 100})
    assert len(body["steps"]) == 3
    assert body["planned_completion_date"] == "2026-10-11"
    assert [s["planned_start_date"] for s in body["steps"]] == ["2026-10-07", "2026-10-08", "2026-10-10"]


def test_d_shared_resource_uses_remainder(scenario_api):
    factory, client = scenario_api
    change(factory, TechnicalCard, 1, quantity=60)
    first = post(client)
    second = post(client, 2)
    verify_saved(factory, first, {"items": 100})
    verify_saved(factory, second, {"items": 100})
    assert [Decimal(a["allocated_amount"]) for a in second["steps"][0]["allocations"]] == [40, 60]


def test_e_late_complete_plan_saved(scenario_api):
    factory, client = scenario_api
    change(factory, TechnicalCard, 1, quantity=250, shipping_date=TODAY)
    body = post(client)
    verify_saved(factory, body, {"items": 100})
    assert body["on_time"] is False and body["delay_days"] == 2 and body["buffer_days"] == -2
    assert body["deviations"] == [{"code": "deadline_missed", "reason": "completion_after_shipping_date", "routing_stage_line_id": None, "resource_key": None}]
    print("SCENARIO_E_RESPONSE=" + json.dumps(body))


@pytest.mark.parametrize("missing", [False, True], ids=["manual-required", "missing-input"])
def test_f_blocked_demand_preserves_exact_previous_plan(scenario_api, missing):
    factory, client = scenario_api
    post(client)
    before = snapshot(factory)
    if missing:
        change(factory, CapacityResource, "items", capacity_unit="linear_meter")
        change(factory, TechOperation, 1, volume_unit="linear_meters")
    else:
        change(factory, CapacityResource, "items", resource_type="labor", capacity_unit="labor_hour", calculation_mode="explicit_hours", base_rate=None)
    body = post(client)
    assert body["status"] == "blocked" and body["persisted"] is False and body["steps"] == []
    assert body["deviations"][0]["code"] == ("demand_calculation_missing" if missing else "manual_required")
    assert body["deviations"][0]["reason"] == ("missing_linear_meters" if missing else "missing_operator_norm")
    assert body["planned_completion_date"] is None and body["on_time"] is None
    assert snapshot(factory) == before
    print("SCENARIO_F_RESPONSE=" + json.dumps(body))


@pytest.mark.parametrize("kind,capacity", [("items", 120), ("meters", 60), ("team", 40), ("labor", 6)])
def test_capacity_formula_real_demands(scenario_api, kind, capacity):
    factory, client = scenario_api
    # Explicit independent budgets: 4h * 2 shifts * .5 efficiency * count * rate.
    fields = dict(hours_per_day=4, shifts_per_day=2, efficiency=Decimal("0.5"), resource_count=3, base_rate=10)
    if kind == "meters":
        fields.update(capacity_unit="linear_meter", base_rate=5)
        change(factory, TechOperation, 1, volume_unit="linear_meters")
        with factory() as db:
            db.add(TechnicalCardOperationLine(technical_card_id=1, sequence=1, source_kind="routing", tech_operation_id=1, operation_name="Items", volume_unit="linear_meters", volume=100, stage_order=1, production_stage_id=1))
            db.commit()
    elif kind == "team":
        fields.update(resource_type="labor", calculation_mode="team_rate", resource_count=1)
    elif kind == "labor":
        fields.update(resource_type="labor", capacity_unit="labor_hour", calculation_mode="sewing_norm", base_rate=None, resource_count=2, efficiency=Decimal("0.375"))
        from app.models.product_model import ProductModel, AssemblyVariant, AssemblyOperationLine
        with factory() as db:
            db.add(ProductModel(id=1, article="VALIDATION", name="Model", size_type="men")); db.flush()
            db.add(AssemblyVariant(id=1, product_model_id=1, name="Assembly")); db.flush()
            db.add(AssemblyOperationLine(assembly_variant_id=1, sequence=1, operation_name="Stitch", duration_seconds=360, quantity_per_item=1))
            db.add(TechnicalCardOperationLine(technical_card_id=1, sequence=1, source_kind="sewing", operation_name="Stitch", volume_unit="pieces", volume=0, stage_order=1, production_stage_id=1))
            db.get(TechnicalCard, 1).product_model_id = 1
            db.get(TechnicalCard, 1).assembly_variant_id = 1
            db.commit()
    change(factory, CapacityResource, "items", **fields)
    body = post(client)
    verify_saved(factory, body, {"items": capacity})
    assert Decimal(body["steps"][0]["allocations"][0]["allocated_amount"]) == min(Decimal(capacity), Decimal(10 if kind == "labor" else 100))


def test_exception_overrides_whole_daily_budget(scenario_api):
    factory, client = scenario_api
    with factory() as db:
        db.add(ProductionCapacityException(resource_key="items", date=TODAY, unavailable=True))
        db.add(ProductionCapacityException(resource_key="items", date=TODAY + timedelta(days=1), unavailable=False, capacity=30))
        db.commit()
    body = post(client)
    verify_saved(factory, body, {"items": lambda day: 0 if day == TODAY else 30 if day == TODAY + timedelta(days=1) else 100})
    assert [Decimal(a["allocated_amount"]) for a in body["steps"][0]["allocations"]] == [30, 70]


def test_recalculation_replaces_auto_preserves_manual_and_entry(scenario_api):
    factory, client = scenario_api
    add_step(factory)
    first = post(client)
    anchor_id = first["steps"][0]["assignment_id"]
    change(factory, CalendarAssignment, anchor_id, planning_mode="manual_adjusted", manual_lock=True, note="Owner step")
    change(factory, CapacityResource, "items", base_rate=200)
    before_stale_replan = snapshot(factory)
    blocked = post(client)
    assert blocked["status"] == "blocked" and not blocked["persisted"]
    assert blocked["deviations"][0]["reason"] == "calendar_plan_stale_after_demand_change"
    assert snapshot(factory) == before_stale_replan
    change(factory, CapacityResource, "items", base_rate=100)
    body = post(client)
    verify_saved(factory, body, {"items": 100})
    assert body["steps"][0]["preserved"] and body["steps"][0]["assignment_id"] == anchor_id
    assert body["steps"][1]["planned_start_date"] == (TODAY + timedelta(days=1)).isoformat()
    with factory() as db:
        assert db.get(CalendarAssignment, anchor_id).note == "Owner step"
        assert set(db.scalars(select(CalendarAllocation.date))) == {TODAY, TODAY + timedelta(days=1)}
    shape = lambda result: [(s["routing_stage_line_id"], s["planned_start_date"], s["planned_end_date"], s["preserved"], s["allocations"]) for s in result["steps"]]
    repeated = post(client)
    assert shape(body) == shape(repeated)
    verify_saved(factory, repeated, {"items": 100})
    before = snapshot(factory)
    change(factory, TechnicalCard, 1, plan_locked=True)
    assert post(client)["deviations"][0]["reason"] == "plan_locked"
    assert snapshot(factory) == before
    change(factory, TechnicalCard, 1, plan_locked=False)
    change(factory, TechOperation, 2, is_active=False)
    assert post(client)["status"] == "blocked"
    assert snapshot(factory) == before
