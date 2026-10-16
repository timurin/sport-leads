from datetime import datetime, timezone

import pytest
from sqlalchemy import event

from tests.test_production_scheduler_pc_04_3a import scheduler, TODAY
from app.models.technical_card import TechnicalCard
from app.models.calendar_assignment import CalendarAssignment
from app.services.production_diagnostics import card_diagnostics
from app.services.platform_health import read_health


def start(db):
    card = db.get(TechnicalCard, 1)
    stage = card.stage_results[0]
    stage.status = "in_progress"
    stage.started_at = datetime(2026, 10, 7, 8, 30, tzinfo=timezone.utc)
    db.flush()
    return card, stage


def test_started_missing_plan_provenance_identical_and_read_only(scheduler):
    factory, engine = scheduler
    with factory() as db:
        card, stage = start(db)
        node_id = stage.id
        db.commit()
    writes = []
    def track(conn, cursor, statement, parameters, context, executemany):
        if statement.lstrip().upper().startswith(("INSERT", "UPDATE", "DELETE")):
            writes.append(statement)
    event.listen(engine, "before_cursor_execute", track)
    try:
        with factory() as db:
            result = card_diagnostics(db, 1)
            issue = next(r for r in result.diagnostics if r.code == "started_step_without_saved_plan")
            assert issue.category == "INTEGRITY" and issue.debug_details["snapshot_node_id"] == node_id
            assert issue.debug_details["fact_status"] == "in_progress"
            assert issue.debug_details["started_at"].startswith("2026-10-07T08:30")
            assert issue.debug_details["calendar_assignment_id"] is None
            assert issue.debug_details["reason_code"] == "unknown"
            assert issue in read_health(db).diagnostics
            assert result.calendar_assignments[0].calendar_assignment_id == 10
            assert issue.trace[2].broken
        assert not writes
    finally:
        event.remove(engine, "before_cursor_execute", track)


@pytest.mark.parametrize("mode,locked", [("auto", False), ("manual_adjusted", True), ("locked", True)])
def test_started_with_saved_assignment_has_no_false_error(scheduler, mode, locked):
    factory, _ = scheduler
    with factory() as db:
        card, stage = start(db)
        card.plan_locked = locked
        db.add(CalendarAssignment(technical_card_id=1, production_stage_id=1,
            routing_stage_line_id=stage.source_routing_stage_line_id, stage_result_id=stage.id,
            planned_date=TODAY, planned_end_date=TODAY, planning_mode=mode, manual_lock=locked))
        db.commit()
        result = card_diagnostics(db, 1)
        assert not any(r.code == "started_step_without_saved_plan" for r in result.diagnostics)
        assert any(r.planning_mode == mode and r.snapshot_node_id == stage.id for r in result.calendar_assignments)


def test_snapshot_mapping_missing_retains_real_manual_assignment(scheduler):
    factory, _ = scheduler
    with factory() as db:
        card, stage = start(db)
        entry = db.get(CalendarAssignment, 10)
        entry.stage_result_id = stage.id
        db.commit()
        issue = next(r for r in card_diagnostics(db, 1).diagnostics if r.code == "started_step_without_saved_plan")
        assert issue.debug_details["reason_code"] == "snapshot_mapping_missing"
        assert issue.debug_details["calendar_assignment_id"] == 10
        assert issue.debug_details["manual_lock"] is True
        assert issue.debug_details["assignment_planning_mode"] == "manual_adjusted"
        assert db.get(CalendarAssignment, 10).routing_stage_line_id is None


def test_missing_fact_timestamp_is_not_invented(scheduler):
    factory, _ = scheduler
    with factory() as db:
        card, stage = start(db)
        stage.started_at = None
        db.commit()
        issue = next(r for r in card_diagnostics(db, 1).diagnostics if r.code == "started_step_without_saved_plan")
        assert issue.debug_details["occurred_at"] is None
