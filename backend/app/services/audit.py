"""Audit event append / query (ADR-025 / 17.1.3.2)."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.audit import AuditEvent
from app.models.auth import PlatformUser

ACTION_SIZE_GRID_CREATE = "size_grid.create"
ACTION_SIZE_GRID_UPDATE = "size_grid.update"
ACTION_SIZE_GRID_DELETE = "size_grid.delete"
ACTION_SIZE_GRID_ROW_CREATE = "size_grid.row.create"
ACTION_SIZE_GRID_ROW_UPDATE = "size_grid.row.update"
ACTION_SIZE_GRID_ROW_DELETE = "size_grid.row.delete"
ACTION_ROLE_ASSIGN = "role.assign"
ACTION_ROLE_REVOKE = "role.revoke"
ACTION_SHOP_STAGE_COMPLETE = "shop.stage.complete"
ACTION_SHOP_STAGE_ROLLBACK_KANBAN = "shop.stage.rollback_kanban"
ACTION_STAGE_EXECUTORS_PUT = "stage_executors.put"


def append_audit_event(
    db: Session,
    *,
    actor: PlatformUser | None,
    action: str,
    entity_type: str,
    entity_id: str | int,
    payload: dict[str, Any] | None = None,
    source: str = "api",
    request_id: str | None = None,
) -> AuditEvent:
    """Append an audit row (caller commits in the same transaction)."""
    event = AuditEvent(
        actor_platform_user_id=actor.id if actor is not None else None,
        actor_login=actor.login if actor is not None else None,
        action=action,
        entity_type=entity_type,
        entity_id=str(entity_id),
        request_id=request_id,
        payload=payload,
        source=source,
    )
    db.add(event)
    db.flush()
    return event


def get_audit_event(db: Session, event_id: int) -> AuditEvent | None:
    return db.get(AuditEvent, event_id)


def list_audit_events(
    db: Session,
    *,
    entity_type: str | None = None,
    entity_id: str | None = None,
    actor_platform_user_id: int | None = None,
    action: str | None = None,
    occurred_from: datetime | None = None,
    occurred_to: datetime | None = None,
    size_grid_id: int | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[AuditEvent]:
    statement = select(AuditEvent)
    if size_grid_id is not None:
        grid_key = str(size_grid_id)
        # Grid-level events + row events that store size_grid_id in payload.
        candidates = list(
            db.scalars(
                select(AuditEvent)
                .where(
                    AuditEvent.entity_type.in_(("size_grid", "size_grid_row"))
                )
                .order_by(AuditEvent.occurred_at.desc(), AuditEvent.id.desc())
                .limit(max(limit + offset, 200))
            ).all()
        )
        matched: list[AuditEvent] = []
        for event in candidates:
            if event.entity_type == "size_grid" and event.entity_id == grid_key:
                matched.append(event)
                continue
            if event.entity_type == "size_grid_row":
                payload = event.payload or {}
                if payload.get("size_grid_id") == size_grid_id:
                    matched.append(event)
        return matched[offset : offset + limit]

    if entity_type is not None:
        statement = statement.where(AuditEvent.entity_type == entity_type)
    if entity_id is not None:
        statement = statement.where(AuditEvent.entity_id == entity_id)
    if actor_platform_user_id is not None:
        statement = statement.where(
            AuditEvent.actor_platform_user_id == actor_platform_user_id
        )
    if action is not None:
        statement = statement.where(AuditEvent.action == action)
    if occurred_from is not None:
        statement = statement.where(AuditEvent.occurred_at >= occurred_from)
    if occurred_to is not None:
        statement = statement.where(AuditEvent.occurred_at <= occurred_to)
    statement = (
        statement.order_by(AuditEvent.occurred_at.desc(), AuditEvent.id.desc())
        .offset(offset)
        .limit(limit)
    )
    return list(db.scalars(statement).all())
