from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.sales import Organization
from app.schemas.sales import OrganizationCreate, OrganizationRead, OrganizationUpdate


class OrganizationNotFoundError(RuntimeError):
    pass


class OrganizationConflictError(RuntimeError):
    pass


class OrganizationValidationError(RuntimeError):
    pass


def list_organizations(
    db: Session,
    *,
    active_only: bool = True,
) -> list[OrganizationRead]:
    statement = select(Organization).order_by(Organization.name, Organization.id)
    if active_only:
        statement = statement.where(Organization.is_active.is_(True))
    return [OrganizationRead.model_validate(item) for item in db.scalars(statement).all()]


def get_organization(db: Session, organization_id: int) -> OrganizationRead:
    row = db.get(Organization, organization_id)
    if row is None:
        raise OrganizationNotFoundError("Organization not found")
    return OrganizationRead.model_validate(row)


def _require_unique_tax_id(
    db: Session,
    tax_id: str | None,
    *,
    exclude_id: int | None = None,
) -> None:
    if not tax_id:
        return
    statement = select(Organization).where(Organization.tax_id == tax_id)
    existing = db.scalar(statement)
    if existing is not None and existing.id != exclude_id:
        raise OrganizationConflictError("Организация с таким ИНН уже есть")


def create_organization(db: Session, payload: OrganizationCreate) -> OrganizationRead:
    _require_unique_tax_id(db, payload.tax_id)
    row = Organization(
        name=payload.name,
        legal_form=payload.legal_form,
        tax_id=payload.tax_id,
        ogrn=payload.ogrn,
        kpp=payload.kpp,
        tax_system=payload.tax_system,
        director=payload.director,
        legal_address=payload.legal_address,
        is_active=payload.is_active,
    )
    db.add(row)
    try:
        db.flush()
    except IntegrityError as error:
        db.rollback()
        raise OrganizationConflictError("Организация с таким ИНН уже есть") from error
    db.refresh(row)
    return OrganizationRead.model_validate(row)


def update_organization(
    db: Session,
    organization_id: int,
    payload: OrganizationUpdate,
) -> OrganizationRead:
    row = db.get(Organization, organization_id)
    if row is None:
        raise OrganizationNotFoundError("Organization not found")
    changes = payload.model_dump(exclude_unset=True)
    if not changes:
        raise OrganizationValidationError("Нет полей для обновления")
    if "tax_id" in changes:
        _require_unique_tax_id(db, changes["tax_id"], exclude_id=organization_id)
    for key, value in changes.items():
        setattr(row, key, value)
    try:
        db.flush()
    except IntegrityError as error:
        db.rollback()
        raise OrganizationConflictError("Организация с таким ИНН уже есть") from error
    db.refresh(row)
    return OrganizationRead.model_validate(row)
