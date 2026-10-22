"""Shared serialization and management-access protection, including legacy APIs."""
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.models.auth import PlatformUser
from app.models.rbac import Permission, role_permissions, platform_user_roles

AccessState = dict[int, tuple[bool, str, set[str]]]


class AccessConflictError(RuntimeError):
    pass


def lock_access(db: Session) -> None:
    if db.get_bind().dialect.name == "postgresql":
        db.execute(text("SELECT pg_advisory_xact_lock(7040421)"))


def access_state(db: Session) -> AccessState:
    state = {row.id: (row.is_active, row.invite_status, set()) for row in db.execute(
        select(PlatformUser.id, PlatformUser.is_active, PlatformUser.invite_status))}
    for uid, code in db.execute(select(platform_user_roles.c.platform_user_id, Permission.code)
        .join(role_permissions, role_permissions.c.role_id == platform_user_roles.c.role_id)
        .join(Permission, Permission.id == role_permissions.c.permission_id)):
        state[uid][2].add(code)
    return state


def can_manage(row: tuple[bool, str, set[str]]) -> bool:
    active, invite, codes = row
    restricted = "sewing_cabinet.read_own" in codes and "sewing_cabinet.read_any" not in codes
    return active and invite == "active" and "admin.roles.assign" in codes and not restricted


def validate_transition(before: AccessState, after: AccessState, actor_id: int | None = None) -> None:
    managers = {uid for uid, row in before.items() if can_manage(row)}
    remaining = {uid for uid, row in after.items() if can_manage(row)}
    if managers and not remaining:
        raise AccessConflictError("last_active_administrator: нельзя лишить последнего администратора доступа")
    if actor_id in managers and actor_id not in remaining:
        raise AccessConflictError("administrator_self_lockout: нельзя лишить себя управления доступом")


def require_actor(state: AccessState, actor_id: int) -> None:
    from app.services.rbac import RbacForbiddenError
    if actor_id not in state or not can_manage(state[actor_id]):
        raise RbacForbiddenError("Недостаточно действующих прав admin.roles.assign")
