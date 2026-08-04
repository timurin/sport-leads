"""Authentication service: PlatformUser + opaque sessions (ADR-023 / 17.1.1.2)."""

from __future__ import annotations

import hashlib
import secrets
from datetime import UTC, datetime, timedelta

from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.config.settings import settings
from app.models.auth import AuthSession, PlatformUser
from app.models.sales import SalesUser
from app.repositories import auth as repo
from app.schemas.auth import AuthLoginRequest, PlatformUserMeRead
from app.services import rbac as rbac_service

SESSION_COOKIE_NAME = "sl_session"

_password_hasher = PasswordHasher()


class AuthError(RuntimeError):
    pass


class AuthUnauthorizedError(AuthError):
    pass


class AuthValidationError(AuthError):
    pass


def _utc_now() -> datetime:
    return datetime.now(tz=UTC)


def hash_password(password: str) -> str:
    return _password_hasher.hash(password)


def verify_password(password_hash: str, password: str) -> bool:
    try:
        return _password_hasher.verify(password_hash, password)
    except VerifyMismatchError:
        return False


def hash_session_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def create_platform_user(
    db: Session,
    *,
    login: str,
    password: str,
    display_name: str,
    sales_user_id: int | None = None,
    is_active: bool = True,
    commit: bool = True,
) -> PlatformUser:
    normalized = login.strip().lower()
    if not normalized:
        raise AuthValidationError("Login обязателен")
    if len(normalized) > 64:
        raise AuthValidationError("Login слишком длинный")
    if not password:
        raise AuthValidationError("Пароль обязателен")
    name = display_name.strip()
    if not name:
        raise AuthValidationError("Отображаемое имя обязательно")
    if repo.get_platform_user_by_login(db, normalized) is not None:
        raise AuthValidationError("Пользователь с таким login уже существует")
    if sales_user_id is not None and db.get(SalesUser, sales_user_id) is None:
        raise AuthValidationError("SalesUser не найден")

    user = PlatformUser(
        login=normalized,
        password_hash=hash_password(password),
        display_name=name,
        is_active=is_active,
        sales_user_id=sales_user_id,
    )
    try:
        repo.add_platform_user(db, user)
        if commit:
            db.commit()
            db.refresh(user)
        else:
            db.flush()
        return user
    except IntegrityError as error:
        db.rollback()
        raise AuthValidationError("Не удалось создать пользователя") from error


def ensure_bootstrap_admin(db: Session) -> PlatformUser | None:
    """Create first PlatformUser from env when the table is empty."""
    login = (settings.auth_bootstrap_login or "").strip().lower()
    password = settings.auth_bootstrap_password or ""
    if not login or not password:
        return None
    if repo.count_platform_users(db) > 0:
        return None
    display = (settings.auth_bootstrap_display_name or login).strip() or login
    user = create_platform_user(
        db,
        login=login,
        password=password,
        display_name=display,
        commit=True,
    )
    return rbac_service.ensure_admin_role_for_user(db, user)


def _as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


def _session_expiry(now: datetime, created_at: datetime | None = None) -> datetime:
    ttl = timedelta(hours=settings.auth_session_ttl_hours)
    max_age = timedelta(hours=settings.auth_session_max_hours)
    created = _as_utc(created_at or now)
    absolute = created + max_age
    sliding = now + ttl
    return sliding if sliding <= absolute else absolute


def login(
    db: Session,
    payload: AuthLoginRequest,
    *,
    user_agent: str | None = None,
    ip_address: str | None = None,
) -> tuple[PlatformUser, str]:
    user = repo.get_platform_user_by_login(db, payload.login)
    if user is None or not user.is_active:
        raise AuthUnauthorizedError("Неверный логин или пароль")
    if not verify_password(user.password_hash, payload.password):
        raise AuthUnauthorizedError("Неверный логин или пароль")

    now = _utc_now()
    raw_token = secrets.token_urlsafe(32)
    session = AuthSession(
        platform_user_id=user.id,
        token_hash=hash_session_token(raw_token),
        created_at=now,
        expires_at=_session_expiry(now, now),
        user_agent=(user_agent or None),
        ip_address=(ip_address or None),
    )
    repo.add_session(db, session)
    db.commit()
    loaded = rbac_service.load_user_with_rbac(db, user.id)
    assert loaded is not None
    return loaded, raw_token


def resolve_session_user(db: Session, raw_token: str | None) -> PlatformUser:
    if not raw_token:
        raise AuthUnauthorizedError("Требуется вход")
    session = repo.get_session_by_token_hash(db, hash_session_token(raw_token))
    if session is None:
        raise AuthUnauthorizedError("Сессия недействительна")
    now = _utc_now()
    if session.revoked_at is not None:
        raise AuthUnauthorizedError("Сессия отозвана")
    expires = _as_utc(session.expires_at)
    if expires <= now:
        raise AuthUnauthorizedError("Сессия истекла")
    user = session.platform_user
    if user is None or not user.is_active:
        raise AuthUnauthorizedError("Пользователь неактивен")

    # Sliding refresh within absolute max age.
    session.expires_at = _session_expiry(now, session.created_at)
    db.commit()
    loaded = rbac_service.load_user_with_rbac(db, user.id)
    assert loaded is not None
    return loaded


def logout(db: Session, raw_token: str | None) -> None:
    if not raw_token:
        return
    session = repo.get_session_by_token_hash(db, hash_session_token(raw_token))
    if session is None:
        return
    if session.revoked_at is None:
        repo.revoke_session(session, revoked_at=_utc_now())
        db.commit()


def to_me_read(user: PlatformUser) -> PlatformUserMeRead:
    return PlatformUserMeRead(
        id=user.id,
        login=user.login,
        display_name=user.display_name,
        is_active=user.is_active,
        sales_user_id=user.sales_user_id,
        roles=rbac_service.role_codes_for_user(user),
        permissions=rbac_service.permission_codes_for_user(user),
    )
