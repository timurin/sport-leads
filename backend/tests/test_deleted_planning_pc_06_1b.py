from datetime import timedelta

import pytest
from sqlalchemy import func, select, text

from tests.test_production_scheduler_pc_04_3a import scheduler, run, TODAY
from tests.test_production_calendar import calendar_client, payload
from app.models.audit import AuditEvent
from app.models.calendar_assignment import CalendarAssignment
from app.models.calendar_allocation import CalendarAllocation
from app.models.technical_card import TechnicalCard
from app.services.tech_card_copy_delete import delete_draft_technical_card
from app.services.technical_cards import TechnicalCardConflictError
from app.services.technical_card_stages import start_stage, complete_stage
from app.services.production_calendar import board
from app.services.calendar_plan_linkage import orphan_assignment_issues
from app.services.platform_health import health_diagnostics


def test_safe_delete_retires_assignments_allocations_and_order_atomically(scheduler):
    factory, _ = scheduler
    run(factory)
    run(factory, card=2)
    with factory() as db:
        own = list(db.scalars(select(CalendarAssignment).where(CalendarAssignment.technical_card_id == 1)))
        assert len(own) == 2
        own_ids = {row.id for row in own}
        own[-1].queue_position = 2
        db.commit()
        other_ids = set(db.scalars(select(CalendarAssignment.id).where(CalendarAssignment.technical_card_id == 2)))
        assert db.scalar(select(func.count()).select_from(CalendarAllocation).where(CalendarAllocation.assignment_id.in_(own_ids))) > 0
        delete_draft_technical_card(db, 1)
        db.commit()
        assert db.get(TechnicalCard, 1) is None
        assert not list(db.scalars(select(CalendarAssignment).where(CalendarAssignment.id.in_(own_ids))))
        assert not list(db.scalars(select(CalendarAllocation).where(CalendarAllocation.assignment_id.in_(own_ids))))
        assert set(db.scalars(select(CalendarAssignment.id))) == other_ids
        assert not orphan_assignment_issues(db)
        assert db.execute(text("PRAGMA foreign_key_check")).all() == []
        deleted = list(db.scalars(select(AuditEvent).where(AuditEvent.action == "calendar.assignment_deleted")))
        assert {row.payload["calendar_assignment_id"] for row in deleted} == own_ids
        assert all(row.payload["reason"] == "technical_card_deleted" for row in deleted)
        for editable in (False, True):
            assert all(row.technical_card_id != 1 for row in board(db, TODAY, TODAY + timedelta(days=30), None, editable_only=editable).assignments)


def test_retirement_and_card_delete_roll_back_together(scheduler):
    factory, _ = scheduler
    run(factory)
    with factory() as db:
        before = set(db.scalars(select(CalendarAssignment.id)))
        allocations = set(db.scalars(select(CalendarAllocation.id)))
        delete_draft_technical_card(db, 1)
        db.rollback()
        assert db.get(TechnicalCard, 1) is not None
        assert set(db.scalars(select(CalendarAssignment.id))) == before
        assert set(db.scalars(select(CalendarAllocation.id))) == allocations
        assert not list(db.scalars(select(AuditEvent).where(AuditEvent.action == "calendar.assignment_deleted")))


@pytest.mark.parametrize("status", ["in_progress", "completed"])
def test_fact_and_completed_history_survive_delete_and_manual_filter(scheduler, status):
    factory, _ = scheduler
    run(factory)
    with factory() as db:
        start_stage(db, 1, 1)
        if status == "completed":
            complete_stage(db, 1, 1)
        assignments = set(db.scalars(select(CalendarAssignment.id)))
        allocations = set(db.scalars(select(CalendarAllocation.id)))
        with pytest.raises(TechnicalCardConflictError):
            delete_draft_technical_card(db, 1)
        db.rollback()
        assert set(db.scalars(select(CalendarAssignment.id))) == assignments
        assert set(db.scalars(select(CalendarAllocation.id))) == allocations
        assert db.get(TechnicalCard, 1).status == status
        history = board(db, TODAY, TODAY + timedelta(days=30), None).assignments
        assert {row.id for row in history} == assignments
        manual = board(db, TODAY, TODAY + timedelta(days=30), None, editable_only=True).assignments
        assert not any(row.operation_state == "completed" for row in manual)
        assert not any(row.id in assignments and row.routing_stage_line_id is not None for row in manual)


def test_legacy_draft_with_confirmed_fact_is_not_deleted(scheduler):
    factory, _ = scheduler
    run(factory)
    with factory() as db:
        db.get(TechnicalCard, 1).stage_results[0].status = "completed"
        db.commit()
        with pytest.raises(TechnicalCardConflictError, match="производственный факт"):
            delete_draft_technical_card(db, 1)
        assert db.get(TechnicalCard, 1) is not None


def test_missing_card_is_hidden_and_diagnosed_in_stale_fixture(scheduler):
    factory, engine = scheduler
    run(factory)
    # Deliberately corrupt an isolated fixture as if an old import disabled FK checks.
    with engine.connect() as connection:
        connection.exec_driver_sql("PRAGMA foreign_keys=OFF")
        connection.execute(CalendarAssignment.__table__.insert().values(
            id=999, technical_card_id=999, production_stage_id=1, planned_date=TODAY,
            planned_end_date=TODAY, position=0, planning_mode="auto", manual_lock=False))
        connection.execute(CalendarAllocation.__table__.insert().values(
            id=999, assignment_id=999, resource_key="items", date=TODAY,
            allocated_amount=1, capacity_unit="item"))
        connection.commit()
        connection.exec_driver_sql("PRAGMA foreign_keys=ON")
    with factory() as db:
        for editable in (False, True):
            assert 999 not in {row.id for row in board(db, TODAY, TODAY + timedelta(days=30), None, editable_only=editable).assignments}
        issues = orphan_assignment_issues(db)
        assert len(issues) == 1
        assert issues[0].category == "INTEGRITY"
        assert issues[0].message == "В производственном плане найдено назначение без техкарты."
        assert issues[0].debug_details["allocation_ids"] == [999]
        assert any(issue.code == "calendar_assignment_without_technical_card" for issue in health_diagnostics(db))


def test_manual_api_scope_preserves_valid_items_and_default_history(calendar_client):
    client, _, _, factory = calendar_client
    for card_id in (1, 2):
        response = client.post("/production-calendar/assignments", json=payload(technical_card_id=card_id))
        assert response.status_code == 200, response.text
    with factory() as db:
        db.get(TechnicalCard, 2).status = "completed"
        db.commit()
    url = "/production-calendar/board?from=2026-10-05&to=2026-10-11"
    assert {row["technical_card_id"] for row in client.get(url).json()["assignments"]} == {1, 2}
    assert {row["technical_card_id"] for row in client.get(url + "&editable_only=true").json()["assignments"]} == {1}
