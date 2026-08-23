"""CRM mailbox settings HTTP API (`1.4.3.4`)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps_auth import get_current_platform_user, require_permission
from app.database.session import get_db
from app.models.auth import PlatformUser
from app.schemas.mailbox_settings import MailboxSettingsRead, MailboxSettingsUpdate
from app.services import rbac as rbac_service
from app.services.mailbox_settings import (
    MailboxSettingsValidationError,
    get_mailbox_settings,
    update_mailbox_settings,
)

router = APIRouter(prefix="/mailbox-settings", tags=["Mailbox settings"])


@router.get(
    "",
    response_model=MailboxSettingsRead,
    operation_id="get_mailbox_settings",
)
def read_mailbox_settings(
    db: Session = Depends(get_db),
    _: PlatformUser = Depends(get_current_platform_user),
) -> MailboxSettingsRead:
    return get_mailbox_settings(db)


@router.put(
    "",
    response_model=MailboxSettingsRead,
    operation_id="update_mailbox_settings",
)
def put_mailbox_settings(
    payload: MailboxSettingsUpdate,
    db: Session = Depends(get_db),
    _: PlatformUser = Depends(
        require_permission(rbac_service.PERM_SYSTEM_SETTINGS_WRITE)
    ),
) -> MailboxSettingsRead:
    try:
        result = update_mailbox_settings(db, payload)
        db.commit()
    except MailboxSettingsValidationError as error:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(error),
        ) from error
    return result
