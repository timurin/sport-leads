from __future__ import annotations

from decimal import Decimal, ROUND_HALF_UP

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.nomenclature import Nomenclature
from app.models.characteristics import NomenclatureVariant
from app.models.product_model import ProductModel
from app.models.sales import SalesOrder, SalesOrderItem, SalesOrderItemVariantSnapshot
from app.models.vat_rate import VatRate
from app.services.characteristics import CharacteristicError, variant_snapshot_rows
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


def _validate_nomenclature(db: Session, nomenclature_id: int | None) -> None:
    if nomenclature_id is not None and db.get(Nomenclature, nomenclature_id) is None:
        raise SalesOrderItemError("Nomenclature not found")


def _resolve_vat_rate(
    db: Session,
    vat_rate_id: int | None,
) -> tuple[int | None, Decimal | None]:
    if vat_rate_id is None:
        return None, None
    rate = db.get(VatRate, vat_rate_id)
    if rate is None or not rate.is_active:
        raise SalesOrderItemError("VAT rate not found")
    return rate.id, rate.rate_percent


def _resolve_product_model(
    db: Session,
    product_model_id: int | None,
    article: str | None,
    name: str | None,
) -> tuple[int | None, str | None, str | None]:
    if product_model_id is None:
        return None, None, None
    model = db.get(ProductModel, product_model_id)
    if model is None:
        raise SalesOrderItemError("Product model not found")
    return (
        model.id,
        (article.strip() if article else None) or model.article,
        (name.strip() if name else None) or model.name,
    )


def _validate_variant(
    db: Session,
    nomenclature_id: int | None,
    variant_id: int | None,
    current_variant_id: int | None = None,
) -> NomenclatureVariant | None:
    if variant_id is None:
        return None
    variant = db.get(NomenclatureVariant, variant_id)
    if variant is None or variant.nomenclature_id != nomenclature_id:
        raise SalesOrderItemError("Nomenclature variant not found")
    if not variant.is_active and variant_id != current_variant_id:
        raise SalesOrderItemError("Inactive nomenclature variant cannot be selected")
    return variant


def _replace_variant_snapshots(db: Session, item: SalesOrderItem) -> None:
    db.query(SalesOrderItemVariantSnapshot).filter(
        SalesOrderItemVariantSnapshot.order_item_id == item.id
    ).delete(synchronize_session=False)
    if item.nomenclature_variant_id is None:
        return
    try:
        rows = variant_snapshot_rows(db, item.nomenclature_variant_id)
    except CharacteristicError as error:
        raise SalesOrderItemError(str(error)) from error
    db.add_all([
        SalesOrderItemVariantSnapshot(order_item_id=item.id, **row) for row in rows
    ])


def create_sales_order_item(
    db: Session,
    order_id: int,
    payload: SalesOrderItemCreate,
) -> SalesOrderItem:
    order = _get_order(db, order_id)
    _validate_nomenclature(db, payload.nomenclature_id)
    _validate_variant(db, payload.nomenclature_id, payload.nomenclature_variant_id)
    vat_rate_id, vat_rate_percent = _resolve_vat_rate(db, payload.vat_rate_id)
    product_model_id, product_model_article, product_model_name = _resolve_product_model(
        db,
        payload.product_model_id,
        payload.product_model_article,
        payload.product_model_name,
    )
    position = max((item.position for item in order.items), default=0) + 1
    item = SalesOrderItem(
        order=order,
        position=position,
        nomenclature_id=payload.nomenclature_id,
        nomenclature_variant_id=payload.nomenclature_variant_id,
        product_model_id=product_model_id,
        product_model_article=product_model_article,
        product_model_name=product_model_name,
        vat_rate_id=vat_rate_id,
        vat_rate_percent=vat_rate_percent,
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
    _replace_variant_snapshots(db, item)
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
    if "nomenclature_id" in changes:
        _validate_nomenclature(db, changes["nomenclature_id"])
    if "nomenclature_variant_id" in changes:
        _validate_variant(
            db,
            changes.get("nomenclature_id", item.nomenclature_id),
            changes["nomenclature_variant_id"],
            item.nomenclature_variant_id,
        )
    for field_name in (
        "snapshot_name",
        "nomenclature_id",
        "nomenclature_variant_id",
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
    if "vat_rate_id" in changes:
        item.vat_rate_id, item.vat_rate_percent = _resolve_vat_rate(db, changes["vat_rate_id"])
    if "product_model_id" in changes or "product_model_article" in changes or "product_model_name" in changes:
        model_id = changes["product_model_id"] if "product_model_id" in changes else item.product_model_id
        article = changes["product_model_article"] if "product_model_article" in changes else item.product_model_article
        name = changes["product_model_name"] if "product_model_name" in changes else item.product_model_name
        item.product_model_id, item.product_model_article, item.product_model_name = _resolve_product_model(
            db, model_id, article, name
        )
    if "nomenclature_id" in changes and "nomenclature_variant_id" not in changes:
        _validate_variant(db, item.nomenclature_id, item.nomenclature_variant_id)
    _, item.discount_amount, item.line_amount = calculate_sales_order_item_totals(
        item.quantity, item.unit_price, item.discount_percent
    )
    db.flush()
    if "nomenclature_variant_id" in changes or "nomenclature_id" in changes:
        _replace_variant_snapshots(db, item)
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
