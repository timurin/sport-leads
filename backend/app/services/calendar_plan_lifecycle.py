"""Calendar plan lifecycle in the canonical append-only AuditEvent store."""
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select, or_, and_
from sqlalchemy.orm import Session

from app.models.audit import AuditEvent
from app.models.auth import PlatformUser
from app.models.calendar_assignment import CalendarAssignment
from app.models.technical_card import TechnicalCardStageResult
from app.services.technical_cards import TechnicalCardConflictError

ENTITY = "calendar_plan_lifecycle"
EVENTS = frozenset({"assignment_created", "assignment_replanned", "assignment_detached",
                   "assignment_deleted", "operation_started", "operation_completed"})


class CannotStartWithoutSavedPlan(TechnicalCardConflictError):
    code = "cannot_start_without_saved_plan"
    category = "INTEGRITY"

    def __init__(self):
        super().__init__("Операция не может быть запущена, пока для неё не сохранён производственный план.")


def assignment_state(row: CalendarAssignment) -> dict[str, Any]:
    return {key: (value.isoformat() if hasattr(value, "isoformat") else value)
            for key in ("technical_card_id", "stage_result_id", "routing_stage_line_id",
                        "production_stage_id", "planned_date", "planned_end_date", "planning_mode", "manual_lock")
            for value in [getattr(row, key)]}


def valid_assignment(db: Session, stage: TechnicalCardStageResult) -> CalendarAssignment | None:
    # The scheduler's route identity plus the current snapshot/workshop binding.
    row = db.scalar(select(CalendarAssignment).where(
        CalendarAssignment.technical_card_id == stage.technical_card_id,
        CalendarAssignment.stage_result_id == stage.id,
        CalendarAssignment.routing_stage_line_id == (stage.source_routing_stage_line_id or stage.id),
        CalendarAssignment.production_stage_id == stage.production_stage_id,
        CalendarAssignment.planned_end_date >= CalendarAssignment.planned_date,
    ).with_for_update())
    from app.services.calendar_plan_linkage import assignment_issues
    return row if row is not None and not assignment_issues(db, row) else None


def assert_saved_plan(db: Session, stage: TechnicalCardStageResult) -> None:
    # The existing calendar scheduler supports standalone (B) cards only.
    # Sales-order (A) operations and workshop-only/FG markers are outside that
    # planning contract. Missing resource links do not opt a B operation out.
    card = stage.technical_card
    planned_operation = (stage.tech_operation_id is not None and card.order_group_id is not None
                         and card.sales_order_id is None)
    if planned_operation:
        from app.services.route_verification import assert_route_reviewed
        assert_route_reviewed(db, card)
    if planned_operation and valid_assignment(db, stage) is None:
        raise CannotStartWithoutSavedPlan()
    if planned_operation:
        from app.services.calendar_plan_freshness import assert_fresh
        assert_fresh(db, valid_assignment(db, stage))


def append_event(db: Session, *, event_type: str, card_id: int, node_id: int | None,
                 operation_id: int | None, assignment_id: int | None,
                 previous_state: dict | None = None, new_state: dict | None = None,
                 reason: str, source: str, actor: PlatformUser | None = None) -> AuditEvent:
    if event_type not in EVENTS:
        raise ValueError("Unknown calendar lifecycle event")
    actor = actor or db.info.get("audit_actor")
    event = AuditEvent(entity_type=ENTITY, entity_id=str(card_id),
        action=f"calendar.{event_type}", occurred_at=datetime.now(timezone.utc),
        actor_platform_user_id=None if actor is None else actor.id,
        actor_login=None if actor is None else actor.login, source=source,
        payload=dict(event_type=event_type, technical_card_id=card_id,
            snapshot_node_id=node_id, tech_operation_id=operation_id,
            calendar_assignment_id=assignment_id, previous_state=previous_state,
            new_state=new_state, reason=reason))
    db.add(event)
    return event


def assignment_event(db: Session, row: CalendarAssignment, event_type: str, *, previous_state: dict | None = None,
                     reason: str, source: str, actor: PlatformUser | None = None, demand_resource_keys=None) -> AuditEvent:
    node = db.get(TechnicalCardStageResult, row.stage_result_id) if row.stage_result_id else None
    event = append_event(db, event_type=event_type, card_id=row.technical_card_id,
        node_id=row.stage_result_id, operation_id=None if node is None else node.tech_operation_id,
        assignment_id=row.id, previous_state=previous_state,
        new_state=None if event_type == "assignment_deleted" else assignment_state(row),
        reason=reason, source=source, actor=actor)
    if event_type == "assignment_created" and row.stage_result_id is not None:
        from app.services.calendar_plan_freshness import input_stamp
        event.payload = event.payload | {"demand_input_snapshot": input_stamp(db, row, resource_keys=demand_resource_keys)}
    return event


def operation_event(db: Session, stage: TechnicalCardStageResult, event_type: str, previous_status: str,
                    *, actor: PlatformUser | None = None, reason: str = "explicit_fact_command",
                    source: str = "stage_fact") -> None:
    if stage.tech_operation_id is None:
        return
    assignment = valid_assignment(db, stage)
    append_event(db, event_type=event_type, card_id=stage.technical_card_id,
        node_id=stage.id, operation_id=stage.tech_operation_id,
        assignment_id=None if assignment is None else assignment.id,
        previous_state={"status": getattr(previous_status, "value", previous_status)},
        new_state={"status": getattr(stage.status, "value", stage.status)},
        reason=reason, source=source, actor=actor)


def detach_for_nodes(db: Session, node_ids: list[int], *, reason: str) -> None:
    from app.services.calendar_plan_linkage import retire_assignments
    nodes = list(db.scalars(select(TechnicalCardStageResult).where(TechnicalCardStageResult.id.in_(node_ids))))
    legacy = [and_(CalendarAssignment.stage_result_id.is_(None), CalendarAssignment.technical_card_id == node.technical_card_id,
                   CalendarAssignment.routing_stage_line_id == (node.source_routing_stage_line_id or node.id)) for node in nodes]
    rows = list(db.scalars(select(CalendarAssignment).where(or_(CalendarAssignment.stage_result_id.in_(node_ids), *legacy))))
    retire_assignments(db, rows, reason=reason, source="route_snapshot", detached=True)


def detach_for_route_lines(db: Session, line_ids: list[int]) -> None:
    from app.services.calendar_plan_linkage import retire_assignments
    rows = list(db.scalars(select(CalendarAssignment).where(CalendarAssignment.routing_stage_line_id.in_(line_ids))))
    retire_assignments(db, rows, reason="route_line_deleted", source="routing", detached=True)


def latest_card_events(db: Session, card_id: int) -> dict[int, AuditEvent]:
    rows = db.scalars(select(AuditEvent).where(AuditEvent.entity_type == ENTITY,
        AuditEvent.entity_id == str(card_id)).order_by(AuditEvent.occurred_at.desc(), AuditEvent.id.desc()))
    latest = {}
    for row in rows:
        node_id = (row.payload or {}).get("snapshot_node_id")
        if node_id is not None:
            latest.setdefault(node_id, row)
    return latest
