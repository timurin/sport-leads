"""Explicit identity mapping only: never grants access or rewrites history."""

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.auth import PlatformUser
from app.models.sales import Employee
from app.services.audit import append_audit_event
from app.services.rbac import PERM_ADMIN_ROLES_ASSIGN, ensure_user_has_permission


class EmployeeLinkNotFoundError(RuntimeError):
    pass


class EmployeeLinkConflictError(RuntimeError):
    pass


def read_employee_link(db: Session, user_id: int, *, actor: PlatformUser) -> PlatformUser:
    ensure_user_has_permission(actor, PERM_ADMIN_ROLES_ASSIGN)
    user = db.get(PlatformUser, user_id)
    if user is None:
        raise EmployeeLinkNotFoundError("Пользователь не найден")
    return user


def change_employee_link(
    db: Session, user_id: int, employee_id: int, *, actor: PlatformUser,
    reason: str, unlink: bool = False,
) -> PlatformUser:
    ensure_user_has_permission(actor, PERM_ADMIN_ROLES_ASSIGN)
    reason = reason.strip()
    if not reason or len(reason) > 500 or employee_id < 1:
        raise ValueError("Укажите корректный ID сотрудника и причину (1–500 символов)")
    user = db.scalar(select(PlatformUser).where(PlatformUser.id == user_id)
                     .with_for_update().execution_options(populate_existing=True))
    if user is None:
        raise EmployeeLinkNotFoundError("Пользователь не найден")
    employee = db.scalar(select(Employee).where(Employee.id == employee_id).with_for_update())
    if employee is None:
        raise EmployeeLinkNotFoundError("Сотрудник не найден")
    before = user.employee_id
    if unlink:
        if before is None:
            return user  # Idempotent retry; no duplicate audit event.
        if before != employee_id:
            raise EmployeeLinkConflictError("Связь изменилась; обновите данные перед отвязкой")
    else:
        if before == employee_id:
            return user
        if before is not None:
            raise EmployeeLinkConflictError("Пользователь уже связан с сотрудником; нужна явная отвязка")
        owner = db.scalar(select(PlatformUser.id).where(PlatformUser.employee_id == employee_id))
        if owner is not None:
            raise EmployeeLinkConflictError("Сотрудник уже связан с другим пользователем")
    try:
        with db.begin_nested():
            user.employee_id = None if unlink else employee_id
            db.flush()
            append_audit_event(
                db, actor=actor,
                action="platform_user.employee_unlinked" if unlink else "platform_user.employee_linked",
                entity_type="platform_user", entity_id=user.id,
                payload={"before": {"employee_id": before},
                         "after": {"employee_id": user.employee_id}, "reason": reason},
            )
    except IntegrityError as error:
        constraint = getattr(getattr(error.orig, "diag", None), "constraint_name", None)
        if constraint == "uq_platform_users_employee_id" or "UNIQUE constraint failed: platform_users.employee_id" in str(error.orig):
            raise EmployeeLinkConflictError("Сотрудник уже связан с другим пользователем") from error
        raise
    return user
