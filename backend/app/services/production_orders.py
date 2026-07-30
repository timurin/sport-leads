"""ProductionOrder / ProductionBatch service (ADR-018 / 11.1.1.3)."""

from __future__ import annotations

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.production_order import (
    ProductionBatch,
    ProductionBatchCardLink,
    ProductionBatchStatus,
    ProductionOrder,
    ProductionOrderStatus,
)
from app.models.sales import SalesOrder
from app.models.technical_card import TechnicalCard
from app.repositories import production_orders as repo
from app.schemas.production_order import (
    ProductionBatchAttachCardRequest,
    ProductionBatchCardLinkRead,
    ProductionBatchCreate,
    ProductionBatchRead,
    ProductionOrderCreate,
    ProductionOrderListItem,
    ProductionOrderRead,
)


class ProductionOrderNotFoundError(RuntimeError):
    pass


class ProductionBatchNotFoundError(RuntimeError):
    pass


class ProductionOrderConflictError(RuntimeError):
    pass


class ProductionOrderValidationError(RuntimeError):
    pass


_DETACH_BLOCKED_STATUSES = frozenset(
    {
        ProductionBatchStatus.RELEASED.value,
        ProductionBatchStatus.IN_PROGRESS.value,
        ProductionBatchStatus.COMPLETED.value,
        ProductionBatchStatus.CANCELLED.value,
    }
)


def _order_number(sales_order_number: str, order_seq: int) -> str:
    return f"PO-{sales_order_number}-{order_seq}"


def _batch_number(production_order_number: str, batch_seq: int) -> str:
    return f"{production_order_number}-B{batch_seq}"


def _link_read(link: ProductionBatchCardLink) -> ProductionBatchCardLinkRead:
    card_number = None
    card = getattr(link, "technical_card", None)
    if card is not None:
        card_number = card.number
    return ProductionBatchCardLinkRead(
        id=link.id,
        production_batch_id=link.production_batch_id,
        technical_card_id=link.technical_card_id,
        technical_card_number=card_number,
        created_at=link.created_at,
    )


def _batch_read(batch: ProductionBatch) -> ProductionBatchRead:
    return ProductionBatchRead(
        id=batch.id,
        production_order_id=batch.production_order_id,
        number=batch.number,
        batch_seq=batch.batch_seq,
        status=batch.status,
        notes=batch.notes,
        card_links=[_link_read(link) for link in batch.card_links],
        created_at=batch.created_at,
        updated_at=batch.updated_at,
    )


def _order_read(
    order: ProductionOrder, sales_order_number: str | None = None
) -> ProductionOrderRead:
    if sales_order_number is None and order.sales_order is not None:
        sales_order_number = order.sales_order.number
    return ProductionOrderRead(
        id=order.id,
        sales_order_id=order.sales_order_id,
        sales_order_number=sales_order_number,
        number=order.number,
        order_seq=order.order_seq,
        status=order.status,
        notes=order.notes,
        batches=[_batch_read(batch) for batch in order.batches],
        created_at=order.created_at,
        updated_at=order.updated_at,
    )


def list_production_orders(
    db: Session,
    *,
    sales_order_id: int | None = None,
    status: str | None = None,
    search: str | None = None,
    limit: int = 100,
    offset: int = 0,
) -> list[ProductionOrderListItem]:
    rows = repo.list_production_orders(
        db,
        sales_order_id=sales_order_id,
        status=status,
        search=search,
        limit=limit,
        offset=offset,
    )
    return [
        ProductionOrderListItem(
            id=order.id,
            sales_order_id=order.sales_order_id,
            sales_order_number=sales_order_number,
            number=order.number,
            order_seq=order.order_seq,
            status=order.status,
            notes=order.notes,
            batch_count=int(batch_count or 0),
            created_at=order.created_at,
            updated_at=order.updated_at,
        )
        for order, sales_order_number, batch_count in rows
    ]


def get_production_order(db: Session, order_id: int) -> ProductionOrderRead:
    order = repo.get_production_order(db, order_id)
    if order is None:
        raise ProductionOrderNotFoundError("Производственный заказ не найден")
    sales_order = db.get(SalesOrder, order.sales_order_id)
    return _order_read(order, sales_order.number if sales_order else None)


def create_production_order(
    db: Session, payload: ProductionOrderCreate
) -> ProductionOrderRead:
    sales_order = db.get(SalesOrder, payload.sales_order_id)
    if sales_order is None:
        raise ProductionOrderValidationError("Заказ покупателя не найден")

    order_seq = repo.next_order_seq(db, sales_order.id)
    row = ProductionOrder(
        sales_order_id=sales_order.id,
        number=_order_number(sales_order.number, order_seq),
        order_seq=order_seq,
        status=ProductionOrderStatus.DRAFT.value,
        notes=payload.notes,
    )
    try:
        db.add(row)
        db.commit()
        db.refresh(row)
    except IntegrityError as error:
        db.rollback()
        raise ProductionOrderConflictError(
            "Не удалось создать производственный заказ (конфликт номера/порядка)"
        ) from error
    return get_production_order(db, row.id)


def create_production_batch(
    db: Session, production_order_id: int, payload: ProductionBatchCreate
) -> ProductionBatchRead:
    order = repo.get_production_order(db, production_order_id)
    if order is None:
        raise ProductionOrderNotFoundError("Производственный заказ не найден")
    if order.status == ProductionOrderStatus.CANCELLED.value:
        raise ProductionOrderValidationError(
            "Нельзя добавить партию в отменённый производственный заказ"
        )

    batch_seq = repo.next_batch_seq(db, order.id)
    batch = ProductionBatch(
        production_order_id=order.id,
        number=_batch_number(order.number, batch_seq),
        batch_seq=batch_seq,
        status=ProductionBatchStatus.DRAFT.value,
        notes=payload.notes,
    )
    db.add(batch)
    db.flush()

    for card_id in payload.technical_card_ids:
        _attach_card_to_batch(db, batch, order, card_id)

    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise ProductionOrderConflictError(
            "Не удалось создать партию или привязать техкарты"
        ) from error

    db.expire_all()
    loaded = repo.get_production_batch(db, batch.id)
    assert loaded is not None
    return _batch_read(loaded)


def attach_technical_card_to_batch(
    db: Session, batch_id: int, payload: ProductionBatchAttachCardRequest
) -> ProductionBatchRead:
    batch = repo.get_production_batch(db, batch_id)
    if batch is None:
        raise ProductionBatchNotFoundError("Партия не найдена")
    order = repo.get_production_order(db, batch.production_order_id)
    if order is None:
        raise ProductionOrderNotFoundError("Производственный заказ не найден")
    if batch.status in _DETACH_BLOCKED_STATUSES:
        raise ProductionOrderValidationError(
            f"Нельзя менять состав партии в статусе `{batch.status}`"
        )

    _attach_card_to_batch(db, batch, order, payload.technical_card_id)
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise ProductionOrderConflictError(
            "Техкарта уже привязана к другой партии"
        ) from error

    db.expire_all()
    loaded = repo.get_production_batch(db, batch.id)
    assert loaded is not None
    return _batch_read(loaded)


def detach_technical_card_from_batch(
    db: Session, batch_id: int, technical_card_id: int
) -> ProductionBatchRead:
    batch = repo.get_production_batch(db, batch_id)
    if batch is None:
        raise ProductionBatchNotFoundError("Партия не найдена")
    if batch.status in _DETACH_BLOCKED_STATUSES:
        raise ProductionOrderValidationError(
            f"Нельзя отвязать техкарту от партии в статусе `{batch.status}`"
        )

    link = repo.get_batch_card_link(db, batch_id, technical_card_id)
    if link is None:
        raise ProductionOrderValidationError("Техкарта не привязана к этой партии")

    db.delete(link)
    db.commit()
    db.expire_all()

    loaded = repo.get_production_batch(db, batch.id)
    assert loaded is not None
    return _batch_read(loaded)


def _attach_card_to_batch(
    db: Session,
    batch: ProductionBatch,
    order: ProductionOrder,
    technical_card_id: int,
) -> None:
    card = db.get(TechnicalCard, technical_card_id)
    if card is None:
        raise ProductionOrderValidationError(
            f"Техкарта #{technical_card_id} не найдена"
        )
    if card.sales_order_id != order.sales_order_id:
        raise ProductionOrderValidationError(
            f"Техкарта #{technical_card_id} принадлежит другому заказу покупателя"
        )
    existing = repo.get_card_link_by_technical_card(db, technical_card_id)
    if existing is not None:
        if existing.production_batch_id == batch.id:
            return
        raise ProductionOrderConflictError(
            f"Техкарта #{technical_card_id} уже привязана к партии #{existing.production_batch_id}"
        )

    db.add(
        ProductionBatchCardLink(
            production_batch_id=batch.id,
            technical_card_id=technical_card_id,
        )
    )
    db.flush()
