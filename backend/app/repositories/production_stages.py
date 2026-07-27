"""ProductionStage (цех) repository (Stage 8.3)."""

from __future__ import annotations

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.models.production_stage import ProductionStage


def list_production_stages(
    db: Session,
    *,
    search: str | None = None,
    active_only: bool = False,
    limit: int = 100,
    offset: int = 0,
) -> list[ProductionStage]:
    statement = select(ProductionStage)
    if active_only:
        statement = statement.where(ProductionStage.is_active.is_(True))
    if search and search.strip():
        pattern = f"%{search.strip().lower()}%"
        statement = statement.where(
            or_(
                func.lower(ProductionStage.name).like(pattern),
                func.lower(ProductionStage.code).like(pattern),
            )
        )
    statement = (
        statement.order_by(ProductionStage.sort_order, ProductionStage.id)
        .limit(limit)
        .offset(offset)
    )
    return list(db.scalars(statement).all())


def get_production_stage(db: Session, stage_id: int) -> ProductionStage | None:
    return db.get(ProductionStage, stage_id)


def get_production_stage_by_name(db: Session, name: str) -> ProductionStage | None:
    return db.scalar(
        select(ProductionStage).where(func.lower(ProductionStage.name) == name.strip().lower())
    )


def get_production_stage_by_code(db: Session, code: str) -> ProductionStage | None:
    return db.scalar(
        select(ProductionStage).where(func.lower(ProductionStage.code) == code.strip().lower())
    )


def add_production_stage(db: Session, row: ProductionStage) -> ProductionStage:
    db.add(row)
    db.flush()
    return row


def apply_production_stage_updates(row: ProductionStage, changes: dict) -> ProductionStage:
    for key, value in changes.items():
        setattr(row, key, value)
    return row


def delete_production_stage(db: Session, row: ProductionStage) -> None:
    db.delete(row)
    db.flush()
