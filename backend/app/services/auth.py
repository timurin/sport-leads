"""Authentication service: PlatformUser + opaque sessions (ADR-023 / 17.1.1.2)."""

from __future__ import annotations

import hashlib
import secrets
from datetime import UTC, datetime, timedelta

from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from sqlalchemy import select
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


INVITE_STATUS_ACTIVE = "active"
INVITE_STATUS_INVITED = "invited"
INVITE_STATUS_PENDING = "pending"
VALID_INVITE_STATUSES = frozenset(
    {INVITE_STATUS_ACTIVE, INVITE_STATUS_INVITED, INVITE_STATUS_PENDING}
)


def create_platform_user(
    db: Session,
    *,
    login: str,
    password: str,
    display_name: str,
    sales_user_id: int | None = None,
    is_active: bool = True,
    email: str | None = None,
    phone: str | None = None,
    department: str | None = None,
    position: str | None = None,
    manager_platform_user_id: int | None = None,
    language: str = "ru",
    invite_status: str = INVITE_STATUS_ACTIVE,
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
    status = (invite_status or INVITE_STATUS_ACTIVE).strip().lower()
    if status not in VALID_INVITE_STATUSES:
        raise AuthValidationError("Некорректный invite_status")
    lang = (language or "ru").strip() or "ru"
    if len(lang) > 16:
        raise AuthValidationError("language слишком длинный")
    if repo.get_platform_user_by_login(db, normalized) is not None:
        raise AuthValidationError("Пользователь с таким login уже существует")
    if sales_user_id is not None and db.get(SalesUser, sales_user_id) is None:
        raise AuthValidationError("SalesUser не найден")
    if manager_platform_user_id is not None and db.get(
        PlatformUser, manager_platform_user_id
    ) is None:
        raise AuthValidationError("Руководитель (PlatformUser) не найден")

    user = PlatformUser(
        login=normalized,
        password_hash=hash_password(password),
        display_name=name,
        is_active=is_active,
        sales_user_id=sales_user_id,
        email=(email.strip() if email else None) or None,
        phone=(phone.strip() if phone else None) or None,
        department=(department.strip() if department else None) or None,
        position=(position.strip() if position else None) or None,
        manager_platform_user_id=manager_platform_user_id,
        language=lang,
        invite_status=status,
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


def invite_platform_user(
    db: Session,
    *,
    login: str,
    display_name: str,
    email: str | None = None,
    phone: str | None = None,
    department: str | None = None,
    position: str | None = None,
    language: str = "ru",
    role_codes: list[str] | None = None,
    temporary_password: str | None = None,
    actor: PlatformUser | None = None,
) -> tuple[PlatformUser, str]:
    """Create invited PlatformUser; returns (user, plaintext temporary password)."""
    password = (temporary_password or "").strip() or secrets.token_urlsafe(12)
    user = create_platform_user(
        db,
        login=login,
        password=password,
        display_name=display_name,
        email=email,
        phone=phone,
        department=department,
        position=position,
        language=language,
        invite_status=INVITE_STATUS_INVITED,
        commit=False,
    )
    user = ensure_sales_user_link(db, user, commit=False)
    for code in role_codes or []:
        normalized_code = code.strip()
        if not normalized_code:
            continue
        rbac_service.assign_role(
            db,
            platform_user_id=user.id,
            role_code=normalized_code,
            actor=actor,
            commit=False,
        )
    db.commit()
    loaded = rbac_service.load_user_with_rbac(db, user.id)
    assert loaded is not None
    return loaded, password


def touch_platform_user_activity(db: Session, user: PlatformUser) -> None:
    """Update last_activity_at; accept invite on first successful auth."""
    now = _utc_now()
    user.last_activity_at = now
    if user.invite_status in {INVITE_STATUS_INVITED, INVITE_STATUS_PENDING}:
        user.invite_status = INVITE_STATUS_ACTIVE


def update_platform_user_profile(
    db: Session,
    *,
    platform_user_id: int,
    fields: dict[str, object],
) -> PlatformUser:
    """Apply partial profile fields; returns user with RBAC loaded."""
    user = rbac_service.load_user_with_rbac(db, platform_user_id)
    if user is None:
        raise AuthValidationError("Пользователь не найден")

    if "display_name" in fields:
        name = str(fields["display_name"] or "").strip()
        if not name:
            raise AuthValidationError("Отображаемое имя обязательно")
        user.display_name = name

    for key in ("email", "phone", "department", "position"):
        if key in fields:
            raw = fields[key]
            if raw is None:
                setattr(user, key, None)
            else:
                text = str(raw).strip()
                setattr(user, key, text or None)

    if "language" in fields:
        lang = str(fields["language"] or "").strip() or "ru"
        if len(lang) > 16:
            raise AuthValidationError("language слишком длинный")
        user.language = lang

    if "is_active" in fields:
        user.is_active = bool(fields["is_active"])

    if "manager_platform_user_id" in fields:
        manager_id = fields["manager_platform_user_id"]
        if manager_id is None:
            user.manager_platform_user_id = None
        else:
            mid = int(manager_id)  # type: ignore[arg-type]
            if mid == platform_user_id:
                raise AuthValidationError(
                    "Нельзя назначить пользователя своим руководителем"
                )
            if db.get(PlatformUser, mid) is None:
                raise AuthValidationError("Руководитель (PlatformUser) не найден")
            user.manager_platform_user_id = mid

    db.commit()
    loaded = rbac_service.load_user_with_rbac(db, platform_user_id)
    assert loaded is not None
    return loaded


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
        commit=False,
    )
    user = ensure_sales_user_link(db, user, commit=False)
    db.commit()
    db.refresh(user)
    return rbac_service.ensure_admin_role_for_user(db, user)


def ensure_sales_user_link(
    db: Session,
    user: PlatformUser,
    *,
    commit: bool = True,
) -> PlatformUser:
    """Ensure PlatformUser has a CRM SalesUser for responsible / author fields.

    Existing admin bootstrap left ``sales_user_id`` null — order create and similar
    flows need a linked employee. Idempotent: no-op when already linked.
    """
    if user.sales_user_id is not None:
        linked = db.get(SalesUser, user.sales_user_id)
        if linked is not None:
            return user
        user.sales_user_id = None

    name = (user.display_name or user.login or "User").strip() or "User"
    sales_user = db.scalar(select(SalesUser).where(SalesUser.name == name).limit(1))
    if sales_user is None:
        sales_user = SalesUser(name=name, is_active=True)
        db.add(sales_user)
        db.flush()
    user.sales_user_id = sales_user.id
    if commit:
        db.commit()
        db.refresh(user)
    else:
        db.flush()
    return user


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

    ensure_sales_user_link(db, user, commit=False)
    touch_platform_user_activity(db, user)

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

    ensure_sales_user_link(db, user, commit=False)
    touch_platform_user_activity(db, user)

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


MIN_PASSWORD_LENGTH = 8


def _require_new_password(password: str) -> str:
    cleaned = (password or "").strip()
    if len(cleaned) < MIN_PASSWORD_LENGTH:
        raise AuthValidationError(
            f"Новый пароль — минимум {MIN_PASSWORD_LENGTH} символов"
        )
    return cleaned


def change_own_password(
    db: Session,
    user: PlatformUser,
    *,
    current_password: str,
    new_password: str,
) -> None:
    if not verify_password(user.password_hash, current_password):
        raise AuthValidationError("Неверный текущий пароль")
    cleaned = _require_new_password(new_password)
    if verify_password(user.password_hash, cleaned):
        raise AuthValidationError("Новый пароль совпадает с текущим")
    row = db.get(PlatformUser, user.id)
    if row is None:
        raise AuthValidationError("Пользователь не найден")
    row.password_hash = hash_password(cleaned)
    db.commit()


def set_platform_user_password(
    db: Session,
    *,
    platform_user_id: int,
    new_password: str,
) -> None:
    cleaned = _require_new_password(new_password)
    row = db.get(PlatformUser, platform_user_id)
    if row is None:
        raise AuthValidationError("Пользователь не найден")
    row.password_hash = hash_password(cleaned)
    db.commit()


def to_me_read(user: PlatformUser) -> PlatformUserMeRead:
    return PlatformUserMeRead(
        id=user.id,
        login=user.login,
        display_name=user.display_name,
        is_active=user.is_active,
        sales_user_id=user.sales_user_id,
        email=getattr(user, "email", None),
        phone=getattr(user, "phone", None),
        department=getattr(user, "department", None),
        position=getattr(user, "position", None),
        manager_platform_user_id=getattr(user, "manager_platform_user_id", None),
        language=getattr(user, "language", None) or "ru",
        invite_status=getattr(user, "invite_status", None) or INVITE_STATUS_ACTIVE,
        last_activity_at=getattr(user, "last_activity_at", None),
        roles=rbac_service.role_codes_for_user(user),
        permissions=rbac_service.permission_codes_for_user(user),
    )
