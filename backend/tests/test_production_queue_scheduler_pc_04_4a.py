from datetime import timedelta
from decimal import Decimal

import pytest
from sqlalchemy import event, func, select

from tests.test_production_scheduler_pc_04_3a import TODAY, scheduler, change, run
from tests.test_scheduler_scenarios_pc_04_3c import scenario_api, snapshot
from app.models.calendar_allocation import CalendarAllocation
from app.models.calendar_assignment import CalendarAssignment
from app.models.production_capacity import CapacityResource
from app.models.technical_card import TechnicalCard, TechnicalCardStageResult
from app.models.technical_card import TechnicalCardOperationLine
from app.models.tech_operation import TechOperation
from app.services.production_queue_scheduler import schedule_queue
from app.services.route_snapshot import copy_template_snapshot


def queue(factory):
    with factory() as db:
        return schedule_queue(db, today=TODAY)


def third_card(factory, **fields):
    with factory() as db:
        card = TechnicalCard(id=3, order_group_id=1, card_seq=3, number="SCHED-3", quantity=100,
                             routing_template_id=1, planning_start_date=TODAY,
                             shipping_date=TODAY + timedelta(days=15), **fields)
        db.add(card)
        db.flush()
        copy_template_snapshot(db, card)
        db.commit()


def verify_budget(factory, capacity=100):
    with factory() as db:
        totals = db.execute(select(CalendarAllocation.date, func.sum(CalendarAllocation.allocated_amount)).group_by(CalendarAllocation.date)).all()
        assert all(total <= capacity for _, total in totals)
        rows = list(db.scalars(select(CalendarAllocation)))
        assert len(rows) == len({(r.assignment_id, r.resource_key, r.date) for r in rows})
        return {(r.technical_card_id, a.date): a.allocated_amount for a, r in db.execute(select(CalendarAllocation, CalendarAssignment).join(CalendarAssignment))}


@pytest.mark.parametrize("a,b,expected", [
    ({"priority": 20}, {"priority": 10}, [2, 1]),
    ({"priority": None}, {"priority": 999999}, [2, 1]),
    ({"priority": 1}, {"priority": 1, "shipping_date": TODAY}, [2, 1]),
    ({"priority": 1, "planning_start_date": TODAY + timedelta(days=1)}, {"priority": 1}, [2, 1]),
    ({"priority": 1}, {"priority": 1}, [1, 2]),
])
def test_queue_order(scheduler, a, b, expected):
    factory, _ = scheduler
    change(factory, TechnicalCard, 1, **a)
    change(factory, TechnicalCard, 2, **b)
    result = queue(factory)
    assert [row.technical_card_id for row in result.results] == expected
    assert result.planned_cards == 2
    verify_budget(factory)


def test_three_cards_remaining_capacity_and_priority_rebuild(scheduler):
    factory, _ = scheduler
    third_card(factory, priority=None)
    change(factory, TechnicalCard, 1, priority=20, quantity=60)
    change(factory, TechnicalCard, 2, priority=10, quantity=60)
    first = queue(factory)
    assert first.status == "planned" and first.total_cards == first.planned_cards == 3
    amounts = verify_budget(factory)
    assert amounts[(2, TODAY)] == 60 and amounts[(1, TODAY)] == 40
    change(factory, TechnicalCard, 1, priority=1)
    second = queue(factory)
    assert [r.technical_card_id for r in second.results] == [1, 2, 3]
    amounts = verify_budget(factory)
    assert amounts[(1, TODAY)] == 60 and amounts[(2, TODAY)] == 40
    assert sum(amounts.values()) == 220
    third = queue(factory)
    assert second.model_dump() == third.model_dump()
    assert verify_budget(factory) == amounts


@pytest.mark.parametrize("field,value,code", [
    ("routing_template_id", None, "readiness_not_complete"),
    ("shipping_date", None, "readiness_not_complete"),
    
    ("plan_locked", True, "locked_assignment_conflict"),
])
def test_blocked_previous_auto_plan_keeps_capacity_during_replay(scheduler, field, value, code):
    factory, _ = scheduler
    # A low-priority old plan cannot be stolen while its card becomes blocked.
    run(factory, card=2)
    change(factory, TechnicalCard, 1, priority=1)
    change(factory, TechnicalCard, 2, priority=100, **{field: value})
    result = queue(factory)
    assert result.status == "partial" and result.planned_cards == result.blocked_cards == 1
    assert result.results[1].deviations[0].code == code
    assert result.results[1].preserved
    amounts = verify_budget(factory)
    assert amounts[(2, TODAY)] == 100
    assert amounts[(1, TODAY + timedelta(days=1))] == 100


def test_missing_input_and_horizon_block_do_not_stop_queue(scheduler):
    factory, _ = scheduler
    third_card(factory)
    change(factory, TechnicalCard, 1, quantity=121, priority=1)
    change(factory, TechnicalCard, 2, routing_template_id=None, priority=1)
    change(factory, CapacityResource, "items", base_rate=1)
    response = queue(factory)
    assert response.status == "partial" and response.planned_cards == 1 and response.blocked_cards == 2
    assert response.results[0].deviations[0].code == "no_available_capacity"
    amounts = verify_budget(factory)
    assert sum(amounts.values()) == 100 and all(key[0] == 3 for key in amounts)


def test_missing_linear_input_skips_card_and_plans_other(scheduler):
    factory, _ = scheduler
    change(factory, CapacityResource, "items", capacity_unit="linear_meter")
    change(factory, TechOperation, 1, volume_unit="linear_meters")
    with factory() as db:
        db.add(TechnicalCardOperationLine(technical_card_id=2, sequence=1, source_kind="routing", tech_operation_id=1,
                                         operation_name="Items", volume_unit="linear_meters", volume=100,
                                         stage_order=1, production_stage_id=1))
        db.commit()
    result = queue(factory)
    assert result.status == "partial"
    blocked = next(row for row in result.results if row.technical_card_id == 1)
    assert blocked.deviations[0].code == "demand_calculation_missing"
    assert blocked.deviations[0].reason == "missing_linear_meters"
    assert result.planned_cards == 1
    verify_budget(factory)


def test_late_plan_and_manual_fact_historical_anchors(scheduler):
    factory, _ = scheduler
    original = run(factory, card=1)
    key = original.steps[0].assignment_id
    change(factory, CalendarAssignment, key, planning_mode="manual_adjusted", manual_lock=True, note="Anchor")
    change(factory, TechnicalCard, 2, shipping_date=TODAY)
    first = queue(factory)
    assert first.preserved_cards == 1 and first.deadline_missed_cards == 1
    late = next(row for row in first.results if row.technical_card_id == 2)
    assert late.delay_days == 1 and late.persisted
    with factory() as db:
        assert db.get(CalendarAssignment, key).note == "Anchor"
        row = db.get(CalendarAssignment, key)
        row.planning_mode, row.manual_lock = "auto", False
        row.planned_date = row.planned_end_date = TODAY - timedelta(days=1)
        db.scalar(select(CalendarAllocation).where(CalendarAllocation.assignment_id == key)).date = row.planned_date
        fact = db.scalar(select(TechnicalCardStageResult).where(
            TechnicalCardStageResult.technical_card_id == 1, TechnicalCardStageResult.stage_order == 1,
        ))
        fact.status = "in_progress"
        db.commit()
    assert queue(factory).preserved_cards == 1
    with factory() as db:
        assert db.get(CalendarAssignment, key).planned_date == TODAY - timedelta(days=1)


def test_unexpected_write_failure_rolls_back_whole_queue(scheduler):
    factory, engine = scheduler
    queue(factory)
    before = snapshot(factory)
    change(factory, TechnicalCard, 1, priority=20)
    change(factory, TechnicalCard, 2, priority=10)
    inserts = 0
    def fail(_, __, sql, ___, ____, _____):
        nonlocal inserts
        if sql.startswith("INSERT INTO calendar_allocations"):
            inserts += 1
            if inserts == 2:
                raise RuntimeError("Injected queue failure")
    event.listen(engine, "before_cursor_execute", fail)
    try:
        with pytest.raises(RuntimeError, match="Injected queue failure"):
            queue(factory)
    finally:
        event.remove(engine, "before_cursor_execute", fail)
    assert snapshot(factory) == before


def test_empty_terminal_exclusion_and_api_permissions(scenario_api):
    factory, client = scenario_api
    from app.api.deps_auth import get_current_platform_user
    from app.main import app
    from app.models.auth import PlatformUser
    result = client.post("/production-calendar/schedule")
    assert result.status_code == 200 and result.json()["planned_cards"] == 2
    change(factory, TechnicalCard, 1, status="completed")
    change(factory, TechnicalCard, 2, status="cancelled")
    assert queue(factory).status == "empty"
    original = app.dependency_overrides[get_current_platform_user]
    try:
        app.dependency_overrides[get_current_platform_user] = lambda: PlatformUser(id=91, login="reader", roles=[])
        assert client.post("/production-calendar/schedule").status_code == 403
        app.dependency_overrides.pop(get_current_platform_user)
        assert client.post("/production-calendar/schedule").status_code == 401
    finally:
        app.dependency_overrides[get_current_platform_user] = original
