"""Auth HTTP API (ADR-023 / 17.1.1.2)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from app.config.settings import settings
from app.database.session import get_db
from app.api.deps_auth import get_current_platform_user
from app.models.auth import PlatformUser
from app.schemas.auth import (
    AuthChangePasswordRequest,
    AuthLoginRequest,
    AuthLoginResponse,
    PlatformUserMeRead,
)
from app.services.auth import (
    SESSION_COOKIE_NAME,
    AuthUnauthorizedError,
    AuthValidationError,
    change_own_password,
    ensure_bootstrap_admin,
    login,
    logout,
    resolve_session_user,
    to_me_read,
)

router = APIRouter(prefix="/auth", tags=["Auth"])


def _set_session_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=token,
        httponly=True,
        secure=settings.auth_cookie_secure,
        samesite=settings.auth_cookie_samesite,
        path="/",
        max_age=int(settings.auth_session_max_hours * 3600),
    )


def _clear_session_cookie(response: Response) -> None:
    response.delete_cookie(
        key=SESSION_COOKIE_NAME,
        path="/",
        httponly=True,
        secure=settings.auth_cookie_secure,
        samesite=settings.auth_cookie_samesite,
    )


def _client_meta(request: Request) -> tuple[str | None, str | None]:
    user_agent = request.headers.get("user-agent")
    if user_agent and len(user_agent) > 512:
        user_agent = user_agent[:512]
    ip = request.client.host if request.client else None
    return user_agent, ip


@router.post(
    "/login",
    response_model=AuthLoginResponse,
    operation_id="auth_login",
)
def auth_login(
    payload: AuthLoginRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> AuthLoginResponse:
    ensure_bootstrap_admin(db)
    user_agent, ip_address = _client_meta(request)
    try:
        user, token = login(
            db,
            payload,
            user_agent=user_agent,
            ip_address=ip_address,
        )
    except AuthUnauthorizedError as error:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(error),
        ) from error
    except AuthValidationError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(error),
        ) from error
    _set_session_cookie(response, token)
    return AuthLoginResponse(user=to_me_read(user))


@router.post(
    "/logout",
    status_code=status.HTTP_204_NO_CONTENT,
    operation_id="auth_logout",
)
def auth_logout(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> Response:
    token = request.cookies.get(SESSION_COOKIE_NAME)
    logout(db, token)
    _clear_session_cookie(response)
    response.status_code = status.HTTP_204_NO_CONTENT
    return response


@router.get(
    "/me",
    response_model=PlatformUserMeRead,
    operation_id="auth_me",
)
def auth_me(
    request: Request,
    db: Session = Depends(get_db),
) -> PlatformUserMeRead:
    ensure_bootstrap_admin(db)
    token = request.cookies.get(SESSION_COOKIE_NAME)
    try:
        user = resolve_session_user(db, token)
    except AuthUnauthorizedError as error:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(error),
        ) from error
    return to_me_read(user)


@router.post(
    "/change-password",
    status_code=status.HTTP_204_NO_CONTENT,
    operation_id="auth_change_password",
)
def auth_change_password(
    payload: AuthChangePasswordRequest,
    db: Session = Depends(get_db),
    user: PlatformUser = Depends(get_current_platform_user),
) -> Response:
    try:
        change_own_password(
            db,
            user,
            current_password=payload.current_password,
            new_password=payload.new_password,
        )
    except AuthValidationError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(error),
        ) from error
    return Response(status_code=status.HTTP_204_NO_CONTENT)
