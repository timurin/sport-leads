"""Purchase order service (Stage 13.1.2 / ADR-034)."""

from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.models.nomenclature import Nomenclature
from app.models.purchase_order import (
    PurchaseOrder,
    PurchaseOrderLine,
    PurchaseOrderStatus,
)
from app.models.supplier import Supplier, SupplierPrice
from app.models.warehouse import Warehouse
from app.schemas.purchase_order import (
    PurchaseOrderCreate,
    PurchaseOrderDetailRead,
    PurchaseOrderLineCreate,
    PurchaseOrderLineRead,
    PurchaseOrderLineUpdate,
    PurchaseOrderListItem,
    PurchaseOrderUpdate,
)


class PurchaseOrderNotFoundError(Exception):
    pass


class PurchaseOrderConflictError(Exception):
    pass


class PurchaseOrderValidationError(Exception):
    pass


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _line_amount(quantity: Decimal, unit_price: Decimal) -> Decimal:
    return (quantity * unit_price).quantize(Decimal("0.01"))


def _total_amount(order: PurchaseOrder) -> Decimal:
    total = Decimal("0.00")
    for line in order.lines:
        total += _line_amount(Decimal(line.quantity), Decimal(line.unit_price))
    return total


def _require_supplier(db: Session, supplier_id: int, *, require_active: bool) -> Supplier:
    supplier = db.get(Supplier, supplier_id)
    if supplier is None:
        raise PurchaseOrderValidationError("Поставщик не найден")
    if require_active and not supplier.is_active:
        raise PurchaseOrderValidationError("Поставщик неактивен")
    return supplier


def _require_nomenclature(db: Session, nomenclature_id: int) -> Nomenclature:
    item = db.get(Nomenclature, nomenclature_id)
    if item is None:
        raise PurchaseOrderValidationError("Номенклатура не найдена")
    return item


def _require_warehouse(db: Session, warehouse_id: int) -> Warehouse:
    warehouse = db.get(Warehouse, warehouse_id)
    if warehouse is None:
        raise PurchaseOrderValidationError("Склад не найден")
    if not warehouse.is_active:
        raise PurchaseOrderValidationError("Склад неактивен")
    return warehouse


def _default_unit_price(
    db: Session, *, supplier_id: int, nomenclature_id: int
) -> Decimal | None:
    statement = select(SupplierPrice).where(
        SupplierPrice.supplier_id == supplier_id,
        SupplierPrice.nomenclature_id == nomenclature_id,
    )
    price = db.scalar(statement)
    if price is None:
        return None
    return Decimal(price.unit_price)


def _resolve_unit_price(
    db: Session,
    *,
    supplier_id: int,
    nomenclature_id: int,
    unit_price: Decimal | None,
) -> Decimal:
    if unit_price is not None:
        if unit_price <= 0:
            raise PurchaseOrderValidationError("Цена должна быть больше нуля")
        return unit_price
    default = _default_unit_price(
        db, supplier_id=supplier_id, nomenclature_id=nomenclature_id
    )
    if default is None:
        raise PurchaseOrderValidationError(
            "Укажите цену: нет цены поставщика для этой номенклатуры"
        )
    return default


def _next_number(db: Session) -> str:
    count = int(db.scalar(select(func.count()).select_from(PurchaseOrder)) or 0)
    return f"PO-{count + 1:06d}"


def _load_order(db: Session, order_id: int) -> PurchaseOrder:
    statement = (
        select(PurchaseOrder)
        .where(PurchaseOrder.id == order_id)
        .options(selectinload(PurchaseOrder.lines))
    )
    order = db.scalar(statement)
    if order is None:
        raise PurchaseOrderNotFoundError("Заказ поставщику не найден")
    return order


def _require_draft(order: PurchaseOrder) -> None:
    if order.status == PurchaseOrderStatus.CANCELLED.value:
        raise PurchaseOrderValidationError("Отменённый заказ нельзя изменять")
    if order.status == PurchaseOrderStatus.ORDERED.value:
        raise PurchaseOrderValidationError("Подтверждённый заказ нельзя изменять")
    if order.status != PurchaseOrderStatus.DRAFT.value:
        raise PurchaseOrderValidationError("Заказ должен быть черновиком")


def _nomenclature_name_map(
    db: Session, nomenclature_ids: list[int]
) -> dict[int, str]:
    if not nomenclature_ids:
        return {}
    rows = db.scalars(
        select(Nomenclature).where(Nomenclature.id.in_(nomenclature_ids))
    ).all()
    return {row.id: row.name for row in rows}


def _to_line_read(
    line: PurchaseOrderLine, *, nomenclature_name: str
) -> PurchaseOrderLineRead:
    qty = Decimal(line.quantity)
    price = Decimal(line.unit_price)
    return PurchaseOrderLineRead(
        id=line.id,
        purchase_order_id=line.purchase_order_id,
        nomenclature_id=line.nomenclature_id,
        nomenclature_name=nomenclature_name,
        quantity=qty,
        unit_price=price,
        line_amount=_line_amount(qty, price),
        comment=line.comment,
        created_at=line.created_at,
        updated_at=line.updated_at,
    )


def to_list_item(
    order: PurchaseOrder, *, supplier_name: str
) -> PurchaseOrderListItem:
    return PurchaseOrderListItem(
        id=order.id,
        number=order.number,
        supplier_id=order.supplier_id,
        supplier_name=supplier_name,
        status=order.status,
        expected_date=order.expected_date,
        warehouse_id=order.warehouse_id,
        total_amount=_total_amount(order),
        currency=order.currency,
        created_at=order.created_at,
        updated_at=order.updated_at,
    )


def to_detail(
    db: Session,
    order: PurchaseOrder,
    *,
    supplier_name: str,
    warehouse_name: str | None,
) -> PurchaseOrderDetailRead:
    names = _nomenclature_name_map(
        db, [line.nomenclature_id for line in order.lines]
    )
    return PurchaseOrderDetailRead(
        id=order.id,
        number=order.number,
        supplier_id=order.supplier_id,
        supplier_name=supplier_name,
        status=order.status,
        expected_date=order.expected_date,
        warehouse_id=order.warehouse_id,
        warehouse_name=warehouse_name,
        notes=order.notes,
        currency=order.currency,
        total_amount=_total_amount(order),
        ordered_at=order.ordered_at,
        cancelled_at=order.cancelled_at,
        created_at=order.created_at,
        updated_at=order.updated_at,
        lines=[
            _to_line_read(
                line,
                nomenclature_name=names.get(line.nomenclature_id, "—"),
            )
            for line in order.lines
        ],
    )


def _detail_from_db(db: Session, order: PurchaseOrder) -> PurchaseOrderDetailRead:
    supplier = db.get(Supplier, order.supplier_id)
    supplier_name = supplier.name if supplier else "—"
    warehouse_name: str | None = None
    if order.warehouse_id is not None:
        warehouse = db.get(Warehouse, order.warehouse_id)
        warehouse_name = warehouse.name if warehouse else None
    return to_detail(
        db,
        order,
        supplier_name=supplier_name,
        warehouse_name=warehouse_name,
    )


def list_purchase_orders(
    db: Session,
    *,
    search: str | None = None,
    status: str | None = None,
    supplier_id: int | None = None,
    limit: int = 100,
    offset: int = 0,
) -> list[PurchaseOrderListItem]:
    statement = (
        select(PurchaseOrder, Supplier.name)
        .join(Supplier, Supplier.id == PurchaseOrder.supplier_id)
        .options(selectinload(PurchaseOrder.lines))
        .order_by(PurchaseOrder.id.desc())
        .offset(offset)
        .limit(limit)
    )
    if status:
        statement = statement.where(PurchaseOrder.status == status)
    if supplier_id is not None:
        statement = statement.where(PurchaseOrder.supplier_id == supplier_id)
    if search:
        pattern = f"%{search.strip()}%"
        statement = statement.where(
            PurchaseOrder.number.ilike(pattern)
            | Supplier.name.ilike(pattern)
        )
    rows = db.execute(statement).all()
    return [to_list_item(order, supplier_name=name) for order, name in rows]


def get_purchase_order(db: Session, order_id: int) -> PurchaseOrderDetailRead:
    order = _load_order(db, order_id)
    return _detail_from_db(db, order)


def create_purchase_order(
    db: Session, payload: PurchaseOrderCreate, *, commit: bool = True
) -> PurchaseOrderDetailRead:
    _require_supplier(db, payload.supplier_id, require_active=True)
    if payload.warehouse_id is not None:
        _require_warehouse(db, payload.warehouse_id)

    seen: set[int] = set()
    prepared: list[tuple[int, Decimal, Decimal, str | None]] = []
    for line in payload.lines:
        if line.nomenclature_id in seen:
            raise PurchaseOrderValidationError(
                "Дублирующаяся номенклатура в строках заказа"
            )
        seen.add(line.nomenclature_id)
        _require_nomenclature(db, line.nomenclature_id)
        price = _resolve_unit_price(
            db,
            supplier_id=payload.supplier_id,
            nomenclature_id=line.nomenclature_id,
            unit_price=line.unit_price,
        )
        prepared.append(
            (line.nomenclature_id, Decimal(line.quantity), price, line.comment)
        )

    number = _next_number(db)
    order = PurchaseOrder(
        number=number,
        supplier_id=payload.supplier_id,
        status=PurchaseOrderStatus.DRAFT.value,
        expected_date=payload.expected_date,
        warehouse_id=payload.warehouse_id,
        notes=payload.notes,
        currency="RUB",
    )
    for nomenclature_id, quantity, unit_price, comment in prepared:
        order.lines.append(
            PurchaseOrderLine(
                nomenclature_id=nomenclature_id,
                quantity=quantity,
                unit_price=unit_price,
                comment=comment,
            )
        )
    try:
        db.add(order)
        db.flush()
        if commit:
            db.commit()
            order = _load_order(db, order.id)
        else:
            db.flush()
            order = _load_order(db, order.id)
        return _detail_from_db(db, order)
    except IntegrityError as error:
        db.rollback()
        raise PurchaseOrderConflictError("Не удалось сохранить заказ поставщику") from error


def update_purchase_order(
    db: Session,
    order_id: int,
    payload: PurchaseOrderUpdate,
    *,
    commit: bool = True,
) -> PurchaseOrderDetailRead:
    order = _load_order(db, order_id)
    _require_draft(order)

    data = payload.model_dump(exclude_unset=True)
    if data.get("clear_expected_date"):
        order.expected_date = None
    elif "expected_date" in data:
        order.expected_date = data["expected_date"]

    if data.get("clear_warehouse"):
        order.warehouse_id = None
    elif "warehouse_id" in data:
        warehouse_id = data["warehouse_id"]
        if warehouse_id is not None:
            _require_warehouse(db, warehouse_id)
        order.warehouse_id = warehouse_id

    if "notes" in data:
        order.notes = data["notes"]

    try:
        db.flush()
        if commit:
            db.commit()
        order = _load_order(db, order_id)
        return _detail_from_db(db, order)
    except IntegrityError as error:
        db.rollback()
        raise PurchaseOrderConflictError("Не удалось обновить заказ поставщику") from error


def create_purchase_order_line(
    db: Session,
    order_id: int,
    payload: PurchaseOrderLineCreate,
    *,
    commit: bool = True,
) -> PurchaseOrderDetailRead:
    order = _load_order(db, order_id)
    _require_draft(order)
    _require_nomenclature(db, payload.nomenclature_id)
    if any(line.nomenclature_id == payload.nomenclature_id for line in order.lines):
        raise PurchaseOrderConflictError("Номенклатура уже есть в заказе")
    price = _resolve_unit_price(
        db,
        supplier_id=order.supplier_id,
        nomenclature_id=payload.nomenclature_id,
        unit_price=payload.unit_price,
    )
    order.lines.append(
        PurchaseOrderLine(
            nomenclature_id=payload.nomenclature_id,
            quantity=Decimal(payload.quantity),
            unit_price=price,
            comment=payload.comment,
        )
    )
    try:
        db.flush()
        if commit:
            db.commit()
        order = _load_order(db, order_id)
        return _detail_from_db(db, order)
    except IntegrityError as error:
        db.rollback()
        raise PurchaseOrderConflictError("Не удалось добавить строку") from error


def update_purchase_order_line(
    db: Session,
    order_id: int,
    line_id: int,
    payload: PurchaseOrderLineUpdate,
    *,
    commit: bool = True,
) -> PurchaseOrderDetailRead:
    order = _load_order(db, order_id)
    _require_draft(order)
    line = next((item for item in order.lines if item.id == line_id), None)
    if line is None:
        raise PurchaseOrderNotFoundError("Строка заказа не найдена")
    data = payload.model_dump(exclude_unset=True)
    if "quantity" in data and data["quantity"] is not None:
        line.quantity = Decimal(data["quantity"])
    if "unit_price" in data and data["unit_price"] is not None:
        line.unit_price = Decimal(data["unit_price"])
    if "comment" in data:
        line.comment = data["comment"]
    try:
        db.flush()
        if commit:
            db.commit()
        order = _load_order(db, order_id)
        return _detail_from_db(db, order)
    except IntegrityError as error:
        db.rollback()
        raise PurchaseOrderConflictError("Не удалось обновить строку") from error


def delete_purchase_order_line(
    db: Session, order_id: int, line_id: int, *, commit: bool = True
) -> PurchaseOrderDetailRead:
    order = _load_order(db, order_id)
    _require_draft(order)
    line = next((item for item in order.lines if item.id == line_id), None)
    if line is None:
        raise PurchaseOrderNotFoundError("Строка заказа не найдена")
    db.delete(line)
    try:
        db.flush()
        if commit:
            db.commit()
        order = _load_order(db, order_id)
        return _detail_from_db(db, order)
    except IntegrityError as error:
        db.rollback()
        raise PurchaseOrderConflictError("Не удалось удалить строку") from error


def confirm_purchase_order(
    db: Session, order_id: int, *, commit: bool = True
) -> PurchaseOrderDetailRead:
    order = _load_order(db, order_id)
    _require_draft(order)
    if not order.lines:
        raise PurchaseOrderValidationError("Нельзя подтвердить заказ без строк")
    order.status = PurchaseOrderStatus.ORDERED.value
    order.ordered_at = _now()
    if commit:
        db.commit()
    else:
        db.flush()
    order = _load_order(db, order_id)
    return _detail_from_db(db, order)


def cancel_purchase_order(
    db: Session, order_id: int, *, commit: bool = True
) -> PurchaseOrderDetailRead:
    order = _load_order(db, order_id)
    if order.status == PurchaseOrderStatus.CANCELLED.value:
        raise PurchaseOrderValidationError("Заказ уже отменён")
    if order.status not in (
        PurchaseOrderStatus.DRAFT.value,
        PurchaseOrderStatus.ORDERED.value,
    ):
        raise PurchaseOrderValidationError("Нельзя отменить заказ в этом статусе")
    order.status = PurchaseOrderStatus.CANCELLED.value
    order.cancelled_at = _now()
    if commit:
        db.commit()
    else:
        db.flush()
    order = _load_order(db, order_id)
    return _detail_from_db(db, order)
