"""Internal collaboration API (ADR-026 / Stage 19.1–19.2)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps_auth import get_current_platform_user
from app.database.session import get_db
from app.models.auth import PlatformUser
from app.schemas.collaboration import (
    CollaborationMentionCandidateRead,
    CollaborationMessageCreate,
    CollaborationMessageRead,
    CollaborationMicrotaskCreate,
    CollaborationMicrotaskRead,
    CollaborationMicrotaskStatusUpdate,
    CollaborationNotificationListRead,
    CollaborationNotificationRead,
)
from app.services import collaboration as collab_svc

router = APIRouter(tags=["Collaboration"])


def _map_error(error: Exception) -> HTTPException:
    if isinstance(error, collab_svc.CollaborationNotFoundError):
        return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error))
    if isinstance(error, collab_svc.CollaborationValidationError):
        return HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=str(error),
        )
    return HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="Collaboration error",
    )


@router.get(
    "/orders/{order_id}/collaboration/messages",
    response_model=list[CollaborationMessageRead],
    operation_id="list_order_collaboration_messages",
)
def list_order_collaboration_messages(
    order_id: int,
    technical_card_id: int | None = Query(default=None, ge=1),
    db: Session = Depends(get_db),
    _user: PlatformUser = Depends(get_current_platform_user),
) -> list[CollaborationMessageRead]:
    try:
        return collab_svc.list_messages(
            db, order_id, technical_card_id=technical_card_id
        )
    except (collab_svc.CollaborationNotFoundError, collab_svc.CollaborationValidationError) as error:
        raise _map_error(error) from error


@router.post(
    "/orders/{order_id}/collaboration/messages",
    response_model=CollaborationMessageRead,
    status_code=status.HTTP_201_CREATED,
    operation_id="create_order_collaboration_message",
)
def create_order_collaboration_message(
    order_id: int,
    payload: CollaborationMessageCreate,
    db: Session = Depends(get_db),
    user: PlatformUser = Depends(get_current_platform_user),
) -> CollaborationMessageRead:
    try:
        return collab_svc.create_message(db, order_id, user, payload)
    except (collab_svc.CollaborationNotFoundError, collab_svc.CollaborationValidationError) as error:
        raise _map_error(error) from error


@router.get(
    "/leads/{lead_id}/collaboration/messages",
    response_model=list[CollaborationMessageRead],
    operation_id="list_lead_collaboration_messages",
)
def list_lead_collaboration_messages(
    lead_id: int,
    db: Session = Depends(get_db),
    _user: PlatformUser = Depends(get_current_platform_user),
) -> list[CollaborationMessageRead]:
    try:
        return collab_svc.list_lead_messages(db, lead_id)
    except (collab_svc.CollaborationNotFoundError, collab_svc.CollaborationValidationError) as error:
        raise _map_error(error) from error


@router.post(
    "/leads/{lead_id}/collaboration/messages",
    response_model=CollaborationMessageRead,
    status_code=status.HTTP_201_CREATED,
    operation_id="create_lead_collaboration_message",
)
def create_lead_collaboration_message(
    lead_id: int,
    payload: CollaborationMessageCreate,
    db: Session = Depends(get_db),
    user: PlatformUser = Depends(get_current_platform_user),
) -> CollaborationMessageRead:
    try:
        return collab_svc.create_lead_message(db, lead_id, user, payload)
    except (collab_svc.CollaborationNotFoundError, collab_svc.CollaborationValidationError) as error:
        raise _map_error(error) from error


@router.get(
    "/technical-cards/{card_id}/collaboration/messages",
    response_model=list[CollaborationMessageRead],
    operation_id="list_standalone_tech_card_collaboration_messages",
)
def list_standalone_tech_card_collaboration_messages(
    card_id: int,
    db: Session = Depends(get_db),
    _user: PlatformUser = Depends(get_current_platform_user),
) -> list[CollaborationMessageRead]:
    try:
        return collab_svc.list_standalone_card_messages(db, card_id)
    except (collab_svc.CollaborationNotFoundError, collab_svc.CollaborationValidationError) as error:
        raise _map_error(error) from error


@router.post(
    "/technical-cards/{card_id}/collaboration/messages",
    response_model=CollaborationMessageRead,
    status_code=status.HTTP_201_CREATED,
    operation_id="create_standalone_tech_card_collaboration_message",
)
def create_standalone_tech_card_collaboration_message(
    card_id: int,
    payload: CollaborationMessageCreate,
    db: Session = Depends(get_db),
    user: PlatformUser = Depends(get_current_platform_user),
) -> CollaborationMessageRead:
    try:
        return collab_svc.create_standalone_card_message(db, card_id, user, payload)
    except (collab_svc.CollaborationNotFoundError, collab_svc.CollaborationValidationError) as error:
        raise _map_error(error) from error


@router.get(
    "/leads/{lead_id}/collaboration/microtasks",
    response_model=list[CollaborationMicrotaskRead],
    operation_id="list_lead_collaboration_microtasks",
)
def list_lead_collaboration_microtasks(
    lead_id: int,
    assignee_platform_user_id: int | None = Query(default=None, ge=1),
    db: Session = Depends(get_db),
    _user: PlatformUser = Depends(get_current_platform_user),
) -> list[CollaborationMicrotaskRead]:
    try:
        return collab_svc.list_lead_microtasks(
            db,
            lead_id,
            assignee_platform_user_id=assignee_platform_user_id,
        )
    except collab_svc.CollaborationNotFoundError as error:
        raise _map_error(error) from error


@router.post(
    "/leads/{lead_id}/collaboration/microtasks",
    response_model=CollaborationMicrotaskRead,
    status_code=status.HTTP_201_CREATED,
    operation_id="create_lead_collaboration_microtask",
)
def create_lead_collaboration_microtask(
    lead_id: int,
    payload: CollaborationMicrotaskCreate,
    db: Session = Depends(get_db),
    user: PlatformUser = Depends(get_current_platform_user),
) -> CollaborationMicrotaskRead:
    try:
        return collab_svc.create_lead_microtask(db, lead_id, user, payload)
    except (collab_svc.CollaborationNotFoundError, collab_svc.CollaborationValidationError) as error:
        raise _map_error(error) from error


@router.get(
    "/orders/{order_id}/collaboration/microtasks",
    response_model=list[CollaborationMicrotaskRead],
    operation_id="list_order_collaboration_microtasks",
)
def list_order_collaboration_microtasks(
    order_id: int,
    assignee_platform_user_id: int | None = Query(default=None, ge=1),
    db: Session = Depends(get_db),
    _user: PlatformUser = Depends(get_current_platform_user),
) -> list[CollaborationMicrotaskRead]:
    try:
        return collab_svc.list_microtasks(
            db,
            order_id,
            assignee_platform_user_id=assignee_platform_user_id,
        )
    except collab_svc.CollaborationNotFoundError as error:
        raise _map_error(error) from error


@router.post(
    "/orders/{order_id}/collaboration/microtasks",
    response_model=CollaborationMicrotaskRead,
    status_code=status.HTTP_201_CREATED,
    operation_id="create_order_collaboration_microtask",
)
def create_order_collaboration_microtask(
    order_id: int,
    payload: CollaborationMicrotaskCreate,
    db: Session = Depends(get_db),
    user: PlatformUser = Depends(get_current_platform_user),
) -> CollaborationMicrotaskRead:
    try:
        return collab_svc.create_microtask(db, order_id, user, payload)
    except (collab_svc.CollaborationNotFoundError, collab_svc.CollaborationValidationError) as error:
        raise _map_error(error) from error


@router.patch(
    "/collaboration/microtasks/{microtask_id}",
    response_model=CollaborationMicrotaskRead,
    operation_id="update_collaboration_microtask_status",
)
def update_collaboration_microtask_status(
    microtask_id: int,
    payload: CollaborationMicrotaskStatusUpdate,
    db: Session = Depends(get_db),
    user: PlatformUser = Depends(get_current_platform_user),
) -> CollaborationMicrotaskRead:
    try:
        return collab_svc.update_microtask_status(db, microtask_id, payload, actor=user)
    except collab_svc.CollaborationNotFoundError as error:
        raise _map_error(error) from error


@router.get(
    "/collaboration/notifications",
    response_model=CollaborationNotificationListRead,
    operation_id="list_collaboration_notifications",
)
def list_collaboration_notifications(
    unread_only: bool = Query(default=False),
    limit: int = Query(default=50, ge=1, le=100),
    db: Session = Depends(get_db),
    user: PlatformUser = Depends(get_current_platform_user),
) -> CollaborationNotificationListRead:
    return collab_svc.list_notifications(
        db, user, unread_only=unread_only, limit=limit
    )


@router.post(
    "/collaboration/notifications/{notification_id}/read",
    response_model=CollaborationNotificationRead,
    operation_id="mark_collaboration_notification_read",
)
def mark_collaboration_notification_read(
    notification_id: int,
    db: Session = Depends(get_db),
    user: PlatformUser = Depends(get_current_platform_user),
) -> CollaborationNotificationRead:
    try:
        return collab_svc.mark_notification_read(db, notification_id, user)
    except collab_svc.CollaborationNotFoundError as error:
        raise _map_error(error) from error


@router.post(
    "/collaboration/notifications/read-all",
    response_model=dict,
    operation_id="mark_all_collaboration_notifications_read",
)
def mark_all_collaboration_notifications_read(
    db: Session = Depends(get_db),
    user: PlatformUser = Depends(get_current_platform_user),
) -> dict:
    count = collab_svc.mark_all_notifications_read(db, user)
    return {"marked": count}


@router.get(
    "/collaboration/mention-candidates",
    response_model=list[CollaborationMentionCandidateRead],
    operation_id="list_collaboration_mention_candidates",
)
def list_collaboration_mention_candidates(
    q: str | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=50),
    db: Session = Depends(get_db),
    _user: PlatformUser = Depends(get_current_platform_user),
) -> list[CollaborationMentionCandidateRead]:
    return collab_svc.list_mention_candidates(db, query=q, limit=limit)


@router.get(
    "/collaboration/microtask-title-templates",
    response_model=list[str],
    operation_id="list_collaboration_microtask_title_templates",
)
def list_collaboration_microtask_title_templates(
    _user: PlatformUser = Depends(get_current_platform_user),
) -> list[str]:
    return collab_svc.list_microtask_title_templates()
