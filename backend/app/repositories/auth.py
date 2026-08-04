from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.auth import AuthSession, PlatformUser


def get_platform_user_by_id(db: Session, user_id: int) -> PlatformUser | None:
    return db.get(PlatformUser, user_id)


def get_platform_user_by_login(db: Session, login: str) -> PlatformUser | None:
    normalized = login.strip().lower()
    return db.scalars(
        select(PlatformUser).where(PlatformUser.login == normalized)
    ).first()


def count_platform_users(db: Session) -> int:
    from sqlalchemy import func

    return int(db.scalar(select(func.count()).select_from(PlatformUser)) or 0)


def add_platform_user(db: Session, user: PlatformUser) -> PlatformUser:
    db.add(user)
    db.flush()
    return user


def get_session_by_token_hash(
    db: Session, token_hash: str
) -> AuthSession | None:
    from app.models.rbac import Role

    return db.scalars(
        select(AuthSession)
        .where(AuthSession.token_hash == token_hash)
        .options(
            selectinload(AuthSession.platform_user)
            .selectinload(PlatformUser.roles)
            .selectinload(Role.permissions)
        )
    ).first()


def add_session(db: Session, session: AuthSession) -> AuthSession:
    db.add(session)
    db.flush()
    return session


def revoke_session(session: AuthSession, *, revoked_at: datetime) -> AuthSession:
    session.revoked_at = revoked_at
    return session
