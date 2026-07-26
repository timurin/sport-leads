from decimal import Decimal

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.vat_rate import VatRate
from app.repositories import vat_rates as repo
from app.schemas.vat_rate import VatRateCreate, VatRateUpdate


class VatRateNotFoundError(RuntimeError):
    pass


class VatRateConflictError(RuntimeError):
    pass


class VatRateValidationError(RuntimeError):
    pass


def list_vat_rates(
    db: Session,
    *,
    is_active: bool | None = None,
    limit: int = 100,
    offset: int = 0,
) -> list[VatRate]:
    return repo.list_vat_rates(db, is_active=is_active, limit=limit, offset=offset)


def get_vat_rate(db: Session, vat_rate_id: int) -> VatRate:
    row = repo.get_vat_rate(db, vat_rate_id)
    if row is None:
        raise VatRateNotFoundError("Ставка НДС не найдена")
    return row


def create_vat_rate(db: Session, payload: VatRateCreate) -> VatRate:
    if repo.get_vat_rate_by_percent(db, payload.rate_percent) is not None:
        raise VatRateConflictError("Ставка НДС с таким процентом уже существует")
    if repo.get_vat_rate_by_name(db, payload.name) is not None:
        raise VatRateConflictError("Ставка НДС с таким наименованием уже существует")

    row = VatRate(
        name=payload.name,
        rate_percent=payload.rate_percent,
        is_active=payload.is_active,
        sort_order=payload.sort_order,
    )
    try:
        repo.add_vat_rate(db, row)
        db.commit()
        db.refresh(row)
        return row
    except IntegrityError as error:
        db.rollback()
        raise VatRateConflictError("Ставка НДС уже существует") from error


def update_vat_rate(db: Session, vat_rate_id: int, payload: VatRateUpdate) -> VatRate:
    row = get_vat_rate(db, vat_rate_id)
    changes = payload.model_dump(exclude_unset=True)
    if not changes:
        raise VatRateValidationError("Нет полей для обновления")

    if "name" in changes:
        existing = repo.get_vat_rate_by_name(db, changes["name"])
        if existing is not None and existing.id != vat_rate_id:
            raise VatRateConflictError("Ставка НДС с таким наименованием уже существует")

    if "rate_percent" in changes and changes["rate_percent"] is not None:
        rate = changes["rate_percent"]
        if not isinstance(rate, Decimal):
            rate = Decimal(str(rate))
        existing = repo.get_vat_rate_by_percent(db, rate)
        if existing is not None and existing.id != vat_rate_id:
            raise VatRateConflictError("Ставка НДС с таким процентом уже существует")
        changes["rate_percent"] = rate

    repo.apply_vat_rate_updates(row, changes)
    try:
        db.commit()
        db.refresh(row)
        return row
    except IntegrityError as error:
        db.rollback()
        raise VatRateConflictError("Ставка НДС уже существует") from error


def delete_vat_rate(db: Session, vat_rate_id: int) -> None:
    row = get_vat_rate(db, vat_rate_id)
    repo.delete_vat_rate(db, row)
    db.commit()
