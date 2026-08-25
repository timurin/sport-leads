"""Sewing-cabinet restricted API surface (ADR-029 / 24.1.2)."""

from __future__ import annotations

from collections.abc import Callable

from sqlalchemy.orm import Session
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from app.config.settings import settings
from app.database.session import SessionLocal, get_db
from app.services.auth import (
    SESSION_COOKIE_NAME,
    AuthUnauthorizedError,
    resolve_session_user,
)
from app.services import rbac as rbac_service

_ALLOWED_EXACT = frozenset(
    {
        "/openapi.json",
        "/docs",
        "/redoc",
        "/version",
    }
)
_ALLOWED_PREFIXES = (
    "/auth",
    "/health",
    "/sewing-cabinet",
    "/tech-card-scan",
)


def is_sewing_cabinet_api_path_allowed(path: str) -> bool:
    normalized = path.rstrip("/") or "/"
    if path in _ALLOWED_EXACT or normalized in _ALLOWED_EXACT:
        return True
    for prefix in _ALLOWED_PREFIXES:
        if path == prefix or path.startswith(f"{prefix}/"):
            return True
    return False


def _with_cors(request: Request, response: Response) -> Response:
    origin = request.headers.get("origin")
    allowed = settings.cors_origins or []
    if origin and origin in allowed:
        response.headers["access-control-allow-origin"] = origin
        response.headers["access-control-allow-credentials"] = "true"
        vary = response.headers.get("vary")
        response.headers["vary"] = "Origin" if not vary else f"{vary}, Origin"
    return response


def _open_db(request: Request) -> tuple[Session, Callable[[], None]]:
    override = request.app.dependency_overrides.get(get_db)
    if override is not None:
        gen = override()
        db = next(gen)

        def close_override() -> None:
            try:
                next(gen)
            except StopIteration:
                pass

        return db, close_override
    factory = getattr(request.app.state, "session_factory", SessionLocal)
    db = factory()
    return db, db.close


def sewing_cabinet_forbidden_response(request: Request) -> Response | None:
    """403 when a restricted sewer hits a non-allowlisted API path."""
    if request.method == "OPTIONS":
        return None
    path = request.url.path
    if is_sewing_cabinet_api_path_allowed(path):
        return None
    token = request.cookies.get(SESSION_COOKIE_NAME)
    if not token:
        return None
    db, close_db = _open_db(request)
    try:
        try:
            user = resolve_session_user(db, token)
        except AuthUnauthorizedError:
            return None
        if not rbac_service.is_sewing_cabinet_restricted(user):
            return None
        return _with_cors(
            request,
            JSONResponse(
                status_code=403,
                content={
                    "detail": (
                        "Кабинет швеи: доступ только к своему кабинету и авторизации"
                    )
                },
            ),
        )
    finally:
        close_db()
