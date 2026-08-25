from __future__ import annotations

from sqlalchemy import or_, select
from sqlalchemy.orm import Session, contains_eager

from app.models.sales import Employee, Organization
from app.schemas.sales import EmployeeCreate, EmployeeRead, EmployeeUpdate


class EmployeeNotFoundError(RuntimeError):
    pass


class EmployeeValidationError(RuntimeError):
    pass


def _to_read(row: Employee) -> EmployeeRead:
    org = row.organization
    return EmployeeRead(
        id=row.id,
        full_name=row.full_name,
        organization_id=row.organization_id,
        organization_name=org.name if org is not None else "",
        position=row.position,
        department=row.department,
        phone=row.phone,
        email=row.email,
        employment_date=row.employment_date,
        is_active=row.is_active,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def _employee_query():
    return (
        select(Employee)
        .join(Organization, Employee.organization_id == Organization.id)
        .options(contains_eager(Employee.organization))
    )


def _require_organization(db: Session, organization_id: int) -> Organization:
    row = db.get(Organization, organization_id)
    if row is None:
        raise EmployeeValidationError("Организация не найдена")
    return row


def list_employees(
    db: Session,
    *,
    active_only: bool = True,
    organization_id: int | None = None,
    q: str | None = None,
) -> list[EmployeeRead]:
    statement = _employee_query().order_by(Employee.full_name, Employee.id)
    if active_only:
        statement = statement.where(Employee.is_active.is_(True))
    if organization_id is not None:
        statement = statement.where(Employee.organization_id == organization_id)
    needle = (q or "").strip()
    if needle:
        pattern = f"%{needle}%"
        statement = statement.where(
            or_(
                Employee.full_name.ilike(pattern),
                Employee.phone.ilike(pattern),
                Employee.email.ilike(pattern),
                Employee.department.ilike(pattern),
                Employee.position.ilike(pattern),
                Organization.name.ilike(pattern),
            )
        )
    return [_to_read(item) for item in db.scalars(statement).unique().all()]


def get_employee(db: Session, employee_id: int) -> EmployeeRead:
    row = db.scalar(_employee_query().where(Employee.id == employee_id))
    if row is None:
        raise EmployeeNotFoundError("Employee not found")
    return _to_read(row)


def create_employee(db: Session, payload: EmployeeCreate) -> EmployeeRead:
    _require_organization(db, payload.organization_id)
    row = Employee(
        full_name=payload.full_name,
        organization_id=payload.organization_id,
        position=payload.position,
        department=payload.department,
        phone=payload.phone,
        email=payload.email,
        employment_date=payload.employment_date,
        is_active=payload.is_active,
    )
    db.add(row)
    db.flush()
    db.refresh(row)
    return get_employee(db, row.id)


def update_employee(
    db: Session,
    employee_id: int,
    payload: EmployeeUpdate,
) -> EmployeeRead:
    row = db.get(Employee, employee_id)
    if row is None:
        raise EmployeeNotFoundError("Employee not found")
    changes = payload.model_dump(exclude_unset=True)
    if not changes:
        raise EmployeeValidationError("Нет полей для обновления")
    if "organization_id" in changes and changes["organization_id"] is not None:
        _require_organization(db, changes["organization_id"])
    for key, value in changes.items():
        setattr(row, key, value)
    db.flush()
    db.refresh(row)
    return get_employee(db, row.id)
