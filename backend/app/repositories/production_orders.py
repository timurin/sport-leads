"""ProductionOrder / ProductionBatch repository (ADR-018 / 11.1.1.3)."""

from __future__ import annotations

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.models.production_order import (
    ProductionBatch,
    ProductionBatchCardLink,
    ProductionOrder,
)
from app.models.sales import SalesOrder
from app.models.technical_card import TechnicalCardOrderGroup


def list_production_orders(
    db: Session,
    *,
    sales_order_id: int | None = None,
    status: str | None = None,
    search: str | None = None,
    limit: int = 100,
    offset: int = 0,
) -> list[tuple[ProductionOrder, str | None, int]]:
    batch_count = (
        select(func.count(ProductionBatch.id))
        .where(ProductionBatch.production_order_id == ProductionOrder.id)
        .correlate(ProductionOrder)
        .scalar_subquery()
    )
    statement = (
        select(
            ProductionOrder,
            func.coalesce(SalesOrder.number, TechnicalCardOrderGroup.order_number),
            batch_count,
        )
        .outerjoin(SalesOrder, SalesOrder.id == ProductionOrder.sales_order_id)
        .outerjoin(
            TechnicalCardOrderGroup,
            TechnicalCardOrderGroup.id == ProductionOrder.order_group_id,
        )
    )
    if sales_order_id is not None:
        statement = statement.where(ProductionOrder.sales_order_id == sales_order_id)
    if status and status.strip():
        statement = statement.where(ProductionOrder.status == status.strip())
    if search and search.strip():
        pattern = f"%{search.strip().lower()}%"
        statement = statement.where(
            or_(
                func.lower(ProductionOrder.number).like(pattern),
                func.lower(func.coalesce(SalesOrder.number, "")).like(pattern),
                func.lower(
                    func.coalesce(TechnicalCardOrderGroup.order_number, "")
                ).like(pattern),
            )
        )
    statement = (
        statement.order_by(ProductionOrder.id.desc()).limit(limit).offset(offset)
    )
    return list(db.execute(statement).all())


def get_production_order(db: Session, order_id: int) -> ProductionOrder | None:
    return db.scalar(
        select(ProductionOrder)
        .where(ProductionOrder.id == order_id)
        .options(
            selectinload(ProductionOrder.batches)
            .selectinload(ProductionBatch.card_links)
            .selectinload(ProductionBatchCardLink.technical_card)
        )
    )


def get_production_batch(db: Session, batch_id: int) -> ProductionBatch | None:
    return db.scalar(
        select(ProductionBatch)
        .where(ProductionBatch.id == batch_id)
        .options(
            selectinload(ProductionBatch.card_links).selectinload(
                ProductionBatchCardLink.technical_card
            )
        )
    )


def next_order_seq(db: Session, sales_order_id: int) -> int:
    current = db.scalar(
        select(func.max(ProductionOrder.order_seq)).where(
            ProductionOrder.sales_order_id == sales_order_id
        )
    )
    return int(current or 0) + 1


def next_order_seq_for_group(db: Session, order_group_id: int) -> int:
    current = db.scalar(
        select(func.max(ProductionOrder.order_seq)).where(
            ProductionOrder.order_group_id == order_group_id
        )
    )
    return int(current or 0) + 1


def next_batch_seq(db: Session, production_order_id: int) -> int:
    current = db.scalar(
        select(func.max(ProductionBatch.batch_seq)).where(
            ProductionBatch.production_order_id == production_order_id
        )
    )
    return int(current or 0) + 1


def get_card_link_by_technical_card(
    db: Session, technical_card_id: int
) -> ProductionBatchCardLink | None:
    return db.scalar(
        select(ProductionBatchCardLink).where(
            ProductionBatchCardLink.technical_card_id == technical_card_id
        )
    )


def get_batch_card_link(
    db: Session, batch_id: int, technical_card_id: int
) -> ProductionBatchCardLink | None:
    return db.scalar(
        select(ProductionBatchCardLink).where(
            ProductionBatchCardLink.production_batch_id == batch_id,
            ProductionBatchCardLink.technical_card_id == technical_card_id,
        )
    )
