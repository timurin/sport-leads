from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.vat_rate import VatRate


def list_vat_rates(
    db: Session,
    *,
    is_active: bool | None = None,
    limit: int = 100,
    offset: int = 0,
) -> list[VatRate]:
    statement = select(VatRate)
    if is_active is not None:
        statement = statement.where(VatRate.is_active.is_(is_active))
    statement = statement.order_by(
        VatRate.sort_order,
        VatRate.rate_percent,
        VatRate.id,
    ).offset(offset).limit(limit)
    return list(db.scalars(statement).all())


def get_vat_rate(db: Session, vat_rate_id: int) -> VatRate | None:
    return db.get(VatRate, vat_rate_id)


def get_vat_rate_by_percent(db: Session, rate_percent) -> VatRate | None:
    return db.scalars(
        select(VatRate).where(VatRate.rate_percent == rate_percent)
    ).first()


def get_vat_rate_by_name(db: Session, name: str) -> VatRate | None:
    return db.scalars(select(VatRate).where(VatRate.name == name)).first()


def add_vat_rate(db: Session, row: VatRate) -> VatRate:
    db.add(row)
    db.flush()
    return row


def apply_vat_rate_updates(row: VatRate, changes: dict) -> VatRate:
    for field_name, value in changes.items():
        setattr(row, field_name, value)
    return row


def delete_vat_rate(db: Session, row: VatRate) -> None:
    db.delete(row)
    db.flush()


def count_vat_rates(db: Session) -> int:
    return int(db.scalar(select(func.count()).select_from(VatRate)) or 0)
