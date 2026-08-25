"""RBAC helpers (ADR-024 / 17.1.2)."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.auth import PlatformUser
from app.models.rbac import Permission, Role, platform_user_roles, role_permissions

PERM_SIZE_GRIDS_WRITE = "size_grids.write"
PERM_SHOP_KANBAN_TRANSITION = "shop.kanban.transition"
PERM_ADMIN_ROLES_ASSIGN = "admin.roles.assign"
PERM_AUDIT_READ = "audit.read"
PERM_SYSTEM_SETTINGS_WRITE = "system_settings.write"
PERM_PLATFORM_DIRECTORIES_WRITE = "platform_directories.write"
PERM_PRINT_FORMS_WRITE = "print_forms.write"
PERM_SEWING_CABINET_READ_OWN = "sewing_cabinet.read_own"
PERM_SEWING_CABINET_READ_ANY = "sewing_cabinet.read_any"
PERM_SEWING_CABINET_WRITE = "sewing_cabinet.write"

MVP_PERMISSIONS: tuple[tuple[str, str], ...] = (
    (PERM_SIZE_GRIDS_WRITE, "Create/update/delete size grids and rows"),
    (PERM_SHOP_KANBAN_TRANSITION, "Shop kanban stage complete / rollback-kanban"),
    (PERM_ADMIN_ROLES_ASSIGN, "Assign or revoke roles on platform users"),
    (PERM_AUDIT_READ, "Query platform audit events"),
    (PERM_SYSTEM_SETTINGS_WRITE, "Update platform system settings"),
    (PERM_PLATFORM_DIRECTORIES_WRITE, "Create/update/delete platform directory rows"),
    (PERM_PRINT_FORMS_WRITE, "Create/update/archive print-form registry entries"),
    (PERM_SEWING_CABINET_READ_OWN, "Read own sewing cabinet queue and earnings"),
    (PERM_SEWING_CABINET_READ_ANY, "Read any sewer cabinet and sewer list"),
    (
        PERM_SEWING_CABINET_WRITE,
        "Take / release / complete sewing work ledger rows",
    ),
)

MVP_ROLES: tuple[tuple[str, str, tuple[str, ...]], ...] = (
    (
        "admin",
        "Administrator",
        (
            PERM_SIZE_GRIDS_WRITE,
            PERM_SHOP_KANBAN_TRANSITION,
            PERM_ADMIN_ROLES_ASSIGN,
            PERM_AUDIT_READ,
            PERM_SYSTEM_SETTINGS_WRITE,
            PERM_PLATFORM_DIRECTORIES_WRITE,
            PERM_PRINT_FORMS_WRITE,
            PERM_SEWING_CABINET_READ_OWN,
            PERM_SEWING_CABINET_READ_ANY,
            PERM_SEWING_CABINET_WRITE,
        ),
    ),
    ("catalog_editor", "Catalog editor", (PERM_SIZE_GRIDS_WRITE,)),
    ("shop_operator", "Shop operator", (PERM_SHOP_KANBAN_TRANSITION,)),
    (
        "sewer",
        "Sewer",
        (PERM_SEWING_CABINET_READ_OWN, PERM_SEWING_CABINET_WRITE),
    ),
    (
        "company_lead",
        "Company lead",
        (PERM_SEWING_CABINET_READ_ANY, PERM_SEWING_CABINET_WRITE),
    ),
    (
        "technologist",
        "Technologist",
        (PERM_SEWING_CABINET_READ_ANY, PERM_SEWING_CABINET_WRITE),
    ),
    (
        "shop_master",
        "Shop master",
        (PERM_SEWING_CABINET_READ_ANY, PERM_SEWING_CABINET_WRITE),
    ),
)

ROLE_ADMIN = "admin"
ROLE_SEWER = "sewer"


class RbacError(RuntimeError):
    pass


class RbacForbiddenError(RbacError):
    pass


class RbacNotFoundError(RbacError):
    pass


class RbacValidationError(RbacError):
    pass


def ensure_rbac_seed(db: Session) -> None:
    """Idempotent MVP permission/role catalog (tests + bootstrap)."""
    for code, description in MVP_PERMISSIONS:
        existing = db.scalars(
            select(Permission).where(Permission.code == code)
        ).first()
        if existing is None:
            db.add(Permission(code=code, description=description))
    db.flush()

    perm_by_code = {
        row.code: row
        for row in db.scalars(select(Permission)).all()
    }
    for role_code, role_name, perm_codes in MVP_ROLES:
        role = db.scalars(select(Role).where(Role.code == role_code)).first()
        if role is None:
            role = Role(code=role_code, name=role_name, is_system=True)
            db.add(role)
            db.flush()
        wanted = {perm_by_code[c] for c in perm_codes if c in perm_by_code}
        current = set(role.permissions or [])
        if current != wanted:
            role.permissions = list(wanted)
    db.flush()


def get_role_by_code(db: Session, code: str) -> Role | None:
    return db.scalars(select(Role).where(Role.code == code)).first()


def load_user_with_rbac(db: Session, user_id: int) -> PlatformUser | None:
    return db.scalars(
        select(PlatformUser)
        .where(PlatformUser.id == user_id)
        .options(
            selectinload(PlatformUser.roles).selectinload(Role.permissions),
        )
    ).first()


def role_codes_for_user(user: PlatformUser) -> list[str]:
    return sorted({role.code for role in (user.roles or [])})


def permission_codes_for_user(user: PlatformUser) -> list[str]:
    return sorted(
        {
            permission.code
            for role in (user.roles or [])
            for permission in (role.permissions or [])
        }
    )


def user_has_permission(user: PlatformUser, code: str) -> bool:
    return code in permission_codes_for_user(user)


def is_sewing_cabinet_restricted(user: PlatformUser) -> bool:
    """Own-cabinet sewer: read_own without read_any (ADR-029 / 24.1.2)."""
    codes = permission_codes_for_user(user)
    return (
        PERM_SEWING_CABINET_READ_OWN in codes
        and PERM_SEWING_CABINET_READ_ANY not in codes
    )


def ensure_user_has_permission(user: PlatformUser, code: str) -> None:
    if not user_has_permission(user, code):
        raise RbacForbiddenError(f"Недостаточно прав: {code}")


def assign_role(
    db: Session,
    *,
    platform_user_id: int,
    role_code: str,
    commit: bool = True,
    actor: PlatformUser | None = None,
) -> PlatformUser:
    from app.services import audit as audit_service

    ensure_rbac_seed(db)
    user = load_user_with_rbac(db, platform_user_id)
    if user is None:
        raise RbacNotFoundError("Пользователь не найден")
    role = get_role_by_code(db, role_code)
    if role is None:
        raise RbacValidationError(f"Роль не найдена: {role_code}")
    if role not in (user.roles or []):
        user.roles.append(role)
    if actor is not None:
        audit_service.append_audit_event(
            db,
            actor=actor,
            action=audit_service.ACTION_ROLE_ASSIGN,
            entity_type="platform_user",
            entity_id=platform_user_id,
            payload={"role_code": role_code},
        )
    if commit:
        db.commit()
    else:
        db.flush()
    refreshed = load_user_with_rbac(db, platform_user_id)
    assert refreshed is not None
    return refreshed


def revoke_role(
    db: Session,
    *,
    platform_user_id: int,
    role_code: str,
    commit: bool = True,
    actor: PlatformUser | None = None,
) -> PlatformUser:
    from app.services import audit as audit_service

    user = load_user_with_rbac(db, platform_user_id)
    if user is None:
        raise RbacNotFoundError("Пользователь не найден")
    role = get_role_by_code(db, role_code)
    if role is None:
        raise RbacValidationError(f"Роль не найдена: {role_code}")
    if role in (user.roles or []):
        user.roles.remove(role)
    if actor is not None:
        audit_service.append_audit_event(
            db,
            actor=actor,
            action=audit_service.ACTION_ROLE_REVOKE,
            entity_type="platform_user",
            entity_id=platform_user_id,
            payload={"role_code": role_code},
        )
    if commit:
        db.commit()
    else:
        db.flush()
    refreshed = load_user_with_rbac(db, platform_user_id)
    assert refreshed is not None
    return refreshed


def ensure_admin_role_for_user(db: Session, user: PlatformUser) -> PlatformUser:
    ensure_rbac_seed(db)
    return assign_role(
        db,
        platform_user_id=user.id,
        role_code=ROLE_ADMIN,
        commit=True,
    )


# Silence unused imports for association tables registered on metadata.
_ = (role_permissions, platform_user_roles)
