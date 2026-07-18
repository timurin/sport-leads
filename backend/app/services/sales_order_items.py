from __future__ import annotations

from decimal import Decimal, ROUND_HALF_UP

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.material import Material
from app.models.sales import SalesOrder, SalesOrderItem
from app.schemas.sales import SalesOrderItemCreate, SalesOrderItemUpdate


class SalesOrderItemError(RuntimeError):
    pass


def _get_order(db: Session, order_id: int) -> SalesOrder:
    order = db.get(SalesOrder, order_id)
    if order is None:
        raise SalesOrderItemError("Order not found")
    return order


def _validate_material(db: Session, material_id: int | None) -> None:
    if material_id is None:
        return
    material = db.get(Material, material_id)
    if material is None or not material.is_active:
        raise SalesOrderItemError("Active material not found")


def _line_total(quantity: Decimal, unit_price: Decimal) -> Decimal:
    return (quantity * unit_price).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def _recalculate_order(order: SalesOrder) -> None:
    order.amount = sum((item.line_total for item in order.items), Decimal("0.00"))


def create_sales_order_item(
    db: Session,
    order_id: int,
    payload: SalesOrderItemCreate,
) -> SalesOrderItem:
    order = _get_order(db, order_id)
    _validate_material(db, payload.material_id)
    position = max((item.position for item in order.items), default=0) + 1
    item = SalesOrderItem(
        order=order,
        material_id=payload.material_id,
        position=position,
        name=payload.name.strip(),
        unit=payload.unit.strip(),
        quantity=payload.quantity,
        unit_price=payload.unit_price,
        line_total=_line_total(payload.quantity, payload.unit_price),
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
    _validate_material(db, changes.get("material_id", item.material_id))
    for field_name in ("material_id", "name", "unit", "quantity", "unit_price"):
        if field_name in changes:
            value = changes[field_name]
            setattr(item, field_name, value.strip() if isinstance(value, str) else value)
    item.line_total = _line_total(item.quantity, item.unit_price)
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
