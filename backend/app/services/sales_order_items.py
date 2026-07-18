from __future__ import annotations

from decimal import Decimal, ROUND_HALF_UP

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.sales import SalesOrder, SalesOrderItem
from app.schemas.sales import SalesOrderItemCreate, SalesOrderItemUpdate


class SalesOrderItemError(RuntimeError):
    pass


def _get_order(db: Session, order_id: int) -> SalesOrder:
    order = db.get(SalesOrder, order_id)
    if order is None:
        raise SalesOrderItemError("Order not found")
    return order


def _money(value: Decimal) -> Decimal:
    return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def calculate_sales_order_item_totals(
    quantity: Decimal,
    unit_price: Decimal,
    discount_percent: Decimal | None,
) -> tuple[Decimal, Decimal, Decimal]:
    gross_amount = _money(quantity * unit_price)
    discount_amount = _money(gross_amount * (discount_percent or Decimal("0")) / Decimal("100"))
    return gross_amount, discount_amount, _money(gross_amount - discount_amount)


def _recalculate_order(order: SalesOrder) -> None:
    order.amount = sum((item.line_amount for item in order.items), Decimal("0.00"))


def create_sales_order_item(
    db: Session,
    order_id: int,
    payload: SalesOrderItemCreate,
) -> SalesOrderItem:
    order = _get_order(db, order_id)
    position = max((item.position for item in order.items), default=0) + 1
    item = SalesOrderItem(
        order=order,
        position=position,
        snapshot_name=payload.snapshot_name.strip(),
        size_range=payload.size_range.strip() if payload.size_range else None,
        personalization=payload.personalization.strip() if payload.personalization else None,
        color=payload.color.strip() if payload.color else None,
        unit=payload.unit.strip(),
        quantity=payload.quantity,
        unit_price=payload.unit_price,
        discount_percent=payload.discount_percent,
        discount_amount=calculate_sales_order_item_totals(
            payload.quantity, payload.unit_price, payload.discount_percent
        )[1],
        line_amount=calculate_sales_order_item_totals(
            payload.quantity, payload.unit_price, payload.discount_percent
        )[2],
    )
    db.add(item)
    db.flush()
    _recalculate_order(order)
    return item


def update_sales_order_item(
    db: Session,
    order_id: int,
    item_id: int,
    payload: SalesOrderItemUpdate,
) -> SalesOrderItem:
    order = _get_order(db, order_id)
    item = db.scalar(
        select(SalesOrderItem).where(
            SalesOrderItem.id == item_id,
            SalesOrderItem.order_id == order_id,
        )
    )
    if item is None:
        raise SalesOrderItemError("Order item not found")
    changes = payload.model_dump(exclude_unset=True)
    for field_name in (
        "snapshot_name",
        "size_range",
        "personalization",
        "color",
        "unit",
        "quantity",
        "unit_price",
        "discount_percent",
    ):
        if field_name in changes:
            value = changes[field_name]
            setattr(item, field_name, value.strip() if isinstance(value, str) and value else value)
    _, item.discount_amount, item.line_amount = calculate_sales_order_item_totals(
        item.quantity, item.unit_price, item.discount_percent
    )
    db.flush()
    _recalculate_order(order)
    return item


def delete_sales_order_item(db: Session, order_id: int, item_id: int) -> None:
    order = _get_order(db, order_id)
    item = db.scalar(
        select(SalesOrderItem).where(
            SalesOrderItem.id == item_id,
            SalesOrderItem.order_id == order_id,
        )
    )
    if item is None:
        raise SalesOrderItemError("Order item not found")
    db.delete(item)
    db.flush()
    _recalculate_order(order)
