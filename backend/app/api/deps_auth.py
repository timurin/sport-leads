"""Auth / RBAC FastAPI dependencies (ADR-023 / ADR-024)."""

from __future__ import annotations

from collections.abc import Callable

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models.auth import PlatformUser
from app.services.auth import (
    SESSION_COOKIE_NAME,
    AuthUnauthorizedError,
    resolve_session_user,
)
from app.services import rbac as rbac_service


def get_current_platform_user(
    request: Request,
    db: Session = Depends(get_db),
) -> PlatformUser:
    token = request.cookies.get(SESSION_COOKIE_NAME)
    try:
        return resolve_session_user(db, token)
    except AuthUnauthorizedError as error:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(error),
        ) from error


def get_optional_platform_user(
    request: Request,
    db: Session = Depends(get_db),
) -> PlatformUser | None:
    token = request.cookies.get(SESSION_COOKIE_NAME)
    if not token:
        return None
    try:
        return resolve_session_user(db, token)
    except AuthUnauthorizedError:
        return None


def require_permission(code: str) -> Callable[..., PlatformUser]:
    def _dependency(
        user: PlatformUser = Depends(get_current_platform_user),
    ) -> PlatformUser:
        try:
            rbac_service.ensure_user_has_permission(user, code)
        except rbac_service.RbacForbiddenError as error:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=str(error),
            ) from error
        return user

    return _dependency
