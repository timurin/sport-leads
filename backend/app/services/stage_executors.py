"""Stage executors service (ADR-024 / 17.1.2.8).

Directory links live in ``platform_user_stage_access``.
Until the directory is filled, fall back to active PlatformUsers with
``shop_operator`` (or ``admin``) role.
"""

from __future__ import annotations

from sqlalchemy import delete, insert, select
from sqlalchemy.orm import Session, selectinload

from app.models.auth import PlatformUser
from app.models.production_stage import ProductionStage
from app.models.stage_executors import platform_user_stage_access
from app.schemas.stage_executors import StageExecutorListRead, StageExecutorRead
from app.services import rbac as rbac_service

FALLBACK_ROLE_CODES = frozenset({"shop_operator", "admin"})


class StageExecutorNotFoundError(Exception):
    pass


def _to_read(user: PlatformUser) -> StageExecutorRead:
    return StageExecutorRead(
        id=user.id,
        login=user.login,
        display_name=user.display_name,
        is_active=user.is_active,
    )


def _resolve_stage(
    db: Session,
    *,
    production_stage_id: int | None = None,
    stage_code: str | None = None,
) -> ProductionStage:
    stage: ProductionStage | None = None
    if production_stage_id is not None:
        stage = db.get(ProductionStage, production_stage_id)
    elif stage_code:
        normalized = stage_code.strip().lower()
        stage = db.scalars(
            select(ProductionStage).where(ProductionStage.code == normalized)
        ).first()
    if stage is None:
        raise StageExecutorNotFoundError("Этап производства не найден")
    return stage


def _linked_users(db: Session, stage_id: int) -> list[PlatformUser]:
    user_ids = db.scalars(
        select(platform_user_stage_access.c.platform_user_id).where(
            platform_user_stage_access.c.production_stage_id == stage_id
        )
    ).all()
    if not user_ids:
        return []
    return list(
        db.scalars(
            select(PlatformUser)
            .where(PlatformUser.id.in_(user_ids), PlatformUser.is_active.is_(True))
            .order_by(PlatformUser.display_name.asc(), PlatformUser.login.asc())
        ).all()
    )


def _fallback_role_users(db: Session) -> list[PlatformUser]:
    rbac_service.ensure_rbac_seed(db)
    users = db.scalars(
        select(PlatformUser)
        .where(PlatformUser.is_active.is_(True))
        .options(selectinload(PlatformUser.roles))
        .order_by(PlatformUser.display_name.asc(), PlatformUser.login.asc())
    ).all()
    return [
        user
        for user in users
        if any(role.code in FALLBACK_ROLE_CODES for role in (user.roles or []))
    ]


def list_stage_executors(
    db: Session,
    *,
    production_stage_id: int | None = None,
    stage_code: str | None = None,
) -> StageExecutorListRead:
    stage = _resolve_stage(
        db,
        production_stage_id=production_stage_id,
        stage_code=stage_code,
    )
    linked = _linked_users(db, stage.id)
    if linked:
        return StageExecutorListRead(
            production_stage_id=stage.id,
            stage_code=stage.code,
            source="directory",
            items=[_to_read(user) for user in linked],
        )

    fallback = _fallback_role_users(db)
    return StageExecutorListRead(
        production_stage_id=stage.id,
        stage_code=stage.code,
        source="role_fallback",
        items=[_to_read(user) for user in fallback],
    )


def set_stage_executors(
    db: Session,
    *,
    production_stage_id: int,
    platform_user_ids: list[int],
    actor: PlatformUser | None = None,
) -> StageExecutorListRead:
    """Replace directory links for a stage (admin assign surface)."""
    from app.services import audit as audit_service

    stage = _resolve_stage(db, production_stage_id=production_stage_id)
    unique_ids = sorted({int(user_id) for user_id in platform_user_ids})
    if unique_ids:
        found = db.scalars(
            select(PlatformUser.id).where(PlatformUser.id.in_(unique_ids))
        ).all()
        if set(found) != set(unique_ids):
            raise StageExecutorNotFoundError("Один или несколько пользователей не найдены")

    db.execute(
        delete(platform_user_stage_access).where(
            platform_user_stage_access.c.production_stage_id == stage.id
        )
    )
    if unique_ids:
        db.execute(
            insert(platform_user_stage_access),
            [
                {
                    "platform_user_id": user_id,
                    "production_stage_id": stage.id,
                }
                for user_id in unique_ids
            ],
        )
    if actor is not None:
        audit_service.append_audit_event(
            db,
            actor=actor,
            action=audit_service.ACTION_STAGE_EXECUTORS_PUT,
            entity_type="production_stage",
            entity_id=stage.id,
            payload={"platform_user_ids": unique_ids, "stage_code": stage.code},
        )
    db.commit()
    return list_stage_executors(db, production_stage_id=stage.id)
