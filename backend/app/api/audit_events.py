"""Audit events HTTP API (17.1.3.2)."""

from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps_auth import require_permission
from app.database.session import get_db
from app.models.auth import PlatformUser
from app.schemas.audit import AuditEventListRead, AuditEventRead
from app.services import audit as audit_service
from app.services import rbac as rbac_service

router = APIRouter(prefix="/audit-events", tags=["Audit"])


@router.get(
    "",
    response_model=AuditEventListRead,
    operation_id="list_audit_events",
)
def list_audit_events_endpoint(
    db: Session = Depends(get_db),
    _: PlatformUser = Depends(require_permission(rbac_service.PERM_AUDIT_READ)),
    entity_type: str | None = Query(default=None, max_length=64),
    entity_id: str | None = Query(default=None, max_length=64),
    actor_platform_user_id: int | None = Query(default=None, ge=1),
    action: str | None = Query(default=None, max_length=128),
    size_grid_id: int | None = Query(default=None, ge=1),
    occurred_from: datetime | None = Query(default=None),
    occurred_to: datetime | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
) -> AuditEventListRead:
    rows = audit_service.list_audit_events(
        db,
        entity_type=entity_type,
        entity_id=entity_id,
        actor_platform_user_id=actor_platform_user_id,
        action=action,
        size_grid_id=size_grid_id,
        occurred_from=occurred_from,
        occurred_to=occurred_to,
        limit=limit,
        offset=offset,
    )
    return AuditEventListRead(items=[AuditEventRead.model_validate(row) for row in rows])


@router.get(
    "/{event_id}",
    response_model=AuditEventRead,
    operation_id="get_audit_event",
)
def get_audit_event_endpoint(
    event_id: int,
    db: Session = Depends(get_db),
    _: PlatformUser = Depends(require_permission(rbac_service.PERM_AUDIT_READ)),
) -> AuditEventRead:
    row = audit_service.get_audit_event(db, event_id)
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Audit event not found",
        )
    return AuditEventRead.model_validate(row)
