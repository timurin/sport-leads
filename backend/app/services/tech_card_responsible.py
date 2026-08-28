"""Tech-card responsible manager (Stage 26.3.6)."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.auth import PlatformUser
from app.models.rbac import Permission, Role, platform_user_roles, role_permissions
from app.models.technical_card import TechnicalCard, TechnicalCardStatus
from app.services import rbac as rbac_service
from app.services.technical_cards import (
    TechnicalCardNotFoundError,
    TechnicalCardValidationError,
)


def platform_user_label(db: Session, user_id: int | None) -> str | None:
    if user_id is None:
        return None
    user = db.get(PlatformUser, user_id)
    if user is None:
        return None
    name = (user.display_name or "").strip()
    return name or user.login


def resolve_responsible_name(
    db: Session,
    card: TechnicalCard,
    *,
    order_responsible_name: str | None,
) -> tuple[str | None, str | None]:
    created_name = platform_user_label(db, card.created_by_platform_user_id)
    assigned_name = platform_user_label(db, card.responsible_platform_user_id)
    return assigned_name or created_name or order_responsible_name, created_name


def list_responsible_candidates(db: Session) -> list[PlatformUser]:
    stmt = (
        select(PlatformUser)
        .join(
            platform_user_roles,
            platform_user_roles.c.platform_user_id == PlatformUser.id,
        )
        .join(Role, Role.id == platform_user_roles.c.role_id)
        .join(role_permissions, role_permissions.c.role_id == Role.id)
        .join(Permission, Permission.id == role_permissions.c.permission_id)
        .where(
            PlatformUser.is_active.is_(True),
            Permission.code == rbac_service.PERM_TECHNICAL_CARDS_CREATE,
        )
        .order_by(PlatformUser.display_name.asc(), PlatformUser.login.asc())
    )
    return list(db.scalars(stmt).unique().all())


def update_technical_card_responsible(
    db: Session,
    card_id: int,
    *,
    responsible_platform_user_id: int | None,
) -> TechnicalCard:
    card = db.get(TechnicalCard, card_id)
    if card is None:
        raise TechnicalCardNotFoundError("Technical card not found")
    if card.status == TechnicalCardStatus.CANCELLED:
        raise TechnicalCardValidationError(
            "Нельзя менять ответственную на отменённой техкарте"
        )
    if responsible_platform_user_id is None:
        card.responsible_platform_user_id = None
        db.flush()
        return card
    user = db.get(PlatformUser, responsible_platform_user_id)
    if user is None or not user.is_active:
        raise TechnicalCardNotFoundError("Пользователь не найден")
    loaded = rbac_service.load_user_with_rbac(db, user.id)
    if loaded is None or not rbac_service.user_has_permission(
        loaded, rbac_service.PERM_TECHNICAL_CARDS_CREATE
    ):
        raise TechnicalCardValidationError(
            "Пользователь не может создавать техкарты"
        )
    card.responsible_platform_user_id = user.id
    db.flush()
    return card
