"""Read-only evidence for started snapshot operations without a saved plan."""
from collections import Counter

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.calendar_assignment import CalendarAssignment
from app.models.calendar_allocation import CalendarAllocation
from app.models.production_stage import ProductionStage
from app.schemas.production_diagnostics import CalendarAssignmentSummary, DiagnosticTraceStep, ProductionDiagnostic
from app.services.route_variants import selection_resolution
from app.services.calendar_plan_lifecycle import latest_card_events


def card_calendar_evidence(db: Session, card):
    assignments = list(db.scalars(select(CalendarAssignment).where(
        CalendarAssignment.technical_card_id == card.id).order_by(CalendarAssignment.id)))
    counts = Counter(db.scalars(select(CalendarAllocation.assignment_id).where(
        CalendarAllocation.assignment_id.in_([row.id for row in assignments]))))
    summaries = tuple(CalendarAssignmentSummary(
        calendar_assignment_id=row.id, snapshot_node_id=row.stage_result_id,
        routing_stage_line_id=row.routing_stage_line_id, workshop_id=row.production_stage_id,
        planning_mode=row.planning_mode, planned_start=row.planned_date, planned_end=row.planned_end_date,
        manual_lock=row.manual_lock, created_at=row.created_at, updated_at=row.updated_at,
        allocation_count=counts[row.id]) for row in assignments)
    workshops = {row.id: row.name for row in db.scalars(select(ProductionStage).where(
        ProductionStage.id.in_({stage.production_stage_id for stage in card.stage_results})))}
    excluded, _ = selection_resolution(card)
    lifecycle = latest_card_events(db, card.id)
    issues = []
    for stage in card.stage_results:
        if f"snapshot:{stage.id}" in excluded or stage.status not in {"in_progress", "completed"} or stage.tech_operation_id is None:
            continue
        identity = stage.source_routing_stage_line_id or stage.id
        # Same identity used for saved anchors by the existing Scheduler. Do not
        # reinterpret a manual/locked assignment or invent a new match rule.
        if any(row.routing_stage_line_id == identity and row.stage_result_id == stage.id
               and row.production_stage_id == stage.production_stage_id
               and row.planned_end_date >= row.planned_date for row in assignments):
            continue
        candidates = [row for row in assignments if row.stage_result_id == stage.id]
        candidate = candidates[0] if len(candidates) == 1 else None
        reason = "snapshot_mapping_missing" if candidates else "unknown"
        last = lifecycle.get(stage.id)
        history = None if last is None else last.payload
        if history and history.get("event_type") in {"assignment_deleted", "assignment_detached"}:
            reason = history["event_type"]
        details = dict(snapshot_node_id=stage.id, operation_id=stage.tech_operation_id,
            operation_name=stage.operation_name, workshop_id=stage.production_stage_id,
            workshop_name=workshops.get(stage.production_stage_id), fact_status=str(stage.status),
            started_at=None if stage.started_at is None else stage.started_at.isoformat(),
            actual_start=None if stage.started_at is None else stage.started_at.isoformat(),
            occurred_at=None if stage.started_at is None else stage.started_at.isoformat(),
            calendar_assignment_id=None if candidate is None else candidate.id,
            assignment_planning_mode=None if candidate is None else candidate.planning_mode,
            planned_start=None if candidate is None else candidate.planned_date.isoformat(),
            planned_end=None if candidate is None else candidate.planned_end_date.isoformat(),
            manual_lock=None if candidate is None else candidate.manual_lock, plan_locked=card.plan_locked,
            routing_stage_line_id=stage.source_routing_stage_line_id, expected_scheduler_identity=identity,
            reason_code=reason, allocation_count=0 if candidate is None else counts[candidate.id],
            candidate_assignment_ids=[row.id for row in candidates])
        details["last_lifecycle_event"] = None if last is None else {
            "audit_event_id": last.id, "event_type": history["event_type"],
            "occurred_at": last.occurred_at.isoformat(), "actor_platform_user_id": last.actor_platform_user_id,
            "actor_login": last.actor_login, "source": last.source,
            "calendar_assignment_id": history.get("calendar_assignment_id"), "reason": history.get("reason"),
            "previous_state": history.get("previous_state"), "new_state": history.get("new_state")}
        explanation = ("Назначение найдено по snapshot node, но его routing mapping не соответствует сохранённому шагу."
                       if candidates else "Сохранённое назначение для этого шага не найдено; история создания/удаления неизвестна.")
        if reason in {"assignment_deleted", "assignment_detached"}:
            explanation = f"Lifecycle audit подтверждает событие {reason}: {history.get('reason')}."
        issues.append(ProductionDiagnostic(code="started_step_without_saved_plan", category="INTEGRITY", module="calendar",
            entity_type="technical_card", entity_id=card.id, entity_name=card.number,
            operation_id=stage.tech_operation_id, field="production_plan", field_label="Сохранённый план операции",
            message=f"ТК {card.number}: операция «{stage.operation_name or stage.tech_operation_id}», snapshot {stage.id}, имеет факт {stage.status}. {explanation}",
            fix_scope="technical_card", expected_source="TechnicalCardStageResult -> CalendarAssignment -> CalendarAllocation",
            source_value={"snapshot_node_id":stage.id,"status":str(stage.status),"started_at":details["started_at"]},
            actual_value={"calendar_assignment_id":details["calendar_assignment_id"],"reason_code":reason},
            reason=reason, fix_action="Проверить факт и mapping сохранённого плана вручную; диагностика не перепланирует операцию.",
            fix_url=f"/production/tech-cards/{card.id}", fix_target={"entity_type":"technical_card","entity_id":card.id,"snapshot_node_id":stage.id},
            debug_details=details, trace=(
                DiagnosticTraceStep(source="TechnicalCard snapshot node",value=stage.id),
                DiagnosticTraceStep(source="TechnicalCardStageResult fact",value={"status":str(stage.status),"started_at":details["started_at"]}),
                DiagnosticTraceStep(source="CalendarAssignment scheduler mapping",value=details["calendar_assignment_id"],broken=True),
                DiagnosticTraceStep(source="CalendarAllocation count",value=details["allocation_count"]))))
    return summaries, issues
