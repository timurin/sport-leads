from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal, ROUND_HALF_UP

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.characteristics import NomenclatureVariant
from app.models.nomenclature import Nomenclature, NomenclatureType
from app.models.product_model import (
    AssemblyVariant,
    ProductModel,
    ProductModelStatus,
)
from app.models.sales import (
    SalesOrder,
    SalesOrderItem,
    SalesOrderItemAssemblyOperationSnapshot,
    SalesOrderItemVariantSnapshot,
)
from app.models.vat_rate import VatRate
from app.repositories import assembly_variants as assembly_repo
from app.repositories import nomenclature_product_models as nomenclature_model_repo
from app.repositories import product_model_routings as model_routing_repo
from app.repositories import shop_routings as shop_routing_repo
from app.schemas.sales import SalesOrderItemCreate, SalesOrderItemUpdate
from app.services.characteristics import CharacteristicError, variant_snapshot_rows


class SalesOrderItemError(RuntimeError):
    pass


@dataclass(frozen=True, slots=True)
class _ResolvedModelAssembly:
    product_model_id: int | None
    product_model_article: str | None
    product_model_name: str | None
    product_model_size_type: str | None
    assembly_variant_id: int | None
    assembly_variant_name: str | None
    assembly_variant_total_cost: Decimal | None
    routing_template_id: int | None
    routing_template_name: str | None
    operation_snapshots: tuple[dict[str, object], ...]


_EMPTY_MODEL_ASSEMBLY = _ResolvedModelAssembly(
    product_model_id=None,
    product_model_article=None,
    product_model_name=None,
    product_model_size_type=None,
    assembly_variant_id=None,
    assembly_variant_name=None,
    assembly_variant_total_cost=None,
    routing_template_id=None,
    routing_template_name=None,
    operation_snapshots=(),
)


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


def calculate_line_vat_amount(
    line_amount: Decimal,
    rate_percent: Decimal | None,
    *,
    price_includes_vat: bool,
) -> Decimal:
    """VAT from line base: inclusive extract or exclusive add-on."""
    rate = rate_percent or Decimal("0")
    if line_amount <= 0 or rate <= 0:
        return Decimal("0.00")
    if price_includes_vat:
        return _money(line_amount * rate / (Decimal("100") + rate))
    return _money(line_amount * rate / Decimal("100"))


def line_gross_amount(item: SalesOrderItem) -> Decimal:
    """Pre–order-discount line contribution with VAT (ignores scaled stored vat)."""
    if item.price_includes_vat:
        return _money(item.line_amount)
    exclusive_vat = calculate_line_vat_amount(
        item.line_amount,
        item.vat_rate_percent,
        price_includes_vat=False,
    )
    return _money(item.line_amount + exclusive_vat)


def _apply_item_vat(item: SalesOrderItem, *, scale: Decimal = Decimal("1")) -> Decimal:
    taxable = _money(item.line_amount * scale)
    item.vat_amount = calculate_line_vat_amount(
        taxable,
        item.vat_rate_percent,
        price_includes_vat=bool(item.price_includes_vat),
    )
    return item.vat_amount


def _recalculate_order(order: SalesOrder) -> None:
    # Pre-discount VAT from entered line bases (mode-aware).
    for item in order.items:
        _apply_item_vat(item, scale=Decimal("1"))

    items_subtotal = _money(
        sum((line_gross_amount(item) for item in order.items), Decimal("0.00"))
    )
    percent = order.discount_percent or Decimal("0")
    order.discount_amount = _money(items_subtotal * percent / Decimal("100"))
    order.amount = _money(items_subtotal - order.discount_amount)

    scale = (
        (order.amount / items_subtotal)
        if items_subtotal > 0
        else Decimal("1")
    )
    order_vat = Decimal("0.00")
    for item in order.items:
        order_vat += _apply_item_vat(item, scale=scale)
    order.vat_amount = _money(order_vat)


def update_sales_order_discount(
    db: Session, order_id: int, discount_percent: Decimal | None
) -> SalesOrder:
    order = _get_order(db, order_id)
    if discount_percent is not None and (
        discount_percent < Decimal("0") or discount_percent > Decimal("100")
    ):
        raise SalesOrderItemError("Order discount percent must be between 0 and 100")
    order.discount_percent = discount_percent
    _recalculate_order(order)
    db.flush()
    return order


def order_items_subtotal(order: SalesOrder) -> Decimal:
    return _money(sum((line_gross_amount(item) for item in order.items), Decimal("0.00")))


def order_amount_net(order: SalesOrder) -> Decimal:
    amount = order.amount or Decimal("0.00")
    return _money(amount - (order.vat_amount or Decimal("0.00")))


def _validate_nomenclature(db: Session, nomenclature_id: int | None) -> Nomenclature | None:
    if nomenclature_id is None:
        return None
    nomenclature = db.get(Nomenclature, nomenclature_id)
    if nomenclature is None:
        raise SalesOrderItemError("Nomenclature not found")
    return nomenclature


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


def _validate_nomenclature_variant(
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


def _replace_assembly_operation_snapshots(
    db: Session,
    item: SalesOrderItem,
    rows: tuple[dict[str, object], ...],
) -> None:
    db.query(SalesOrderItemAssemblyOperationSnapshot).filter(
        SalesOrderItemAssemblyOperationSnapshot.order_item_id == item.id
    ).delete(synchronize_session=False)
    db.add_all(
        [
            SalesOrderItemAssemblyOperationSnapshot(order_item_id=item.id, **row)
            for row in rows
        ]
    )


def _active_variant_count(db: Session, product_model_id: int) -> int:
    return int(
        db.scalar(
            select(func.count())
            .select_from(AssemblyVariant)
            .where(
                AssemblyVariant.product_model_id == product_model_id,
                AssemblyVariant.is_active.is_(True),
            )
        )
        or 0
    )


def _operation_snapshot_rows(variant: AssemblyVariant) -> tuple[dict[str, object], ...]:
    lines = sorted(variant.operation_lines, key=lambda row: (row.sequence, row.id))
    return tuple(
        {
            "sequence": line.sequence,
            "operation_name": line.operation_name,
            "cost": line.cost,
            "quantity_per_item": line.quantity_per_item,
            "duration_seconds": line.duration_seconds,
            "sewing_operation_id": line.sewing_operation_id,
        }
        for line in lines
    )


def _resolve_routing_snapshot(
    db: Session,
    *,
    product_model_id: int,
    routing_template_id: int | None,
    current_routing_template_id: int | None = None,
) -> tuple[int | None, str | None]:
    """Bind ShopRoutingTemplate from the model whitelist; server fills name snapshot."""
    active_template_ids = model_routing_repo.list_template_ids(
        db, product_model_id, active_only=True
    )

    if routing_template_id is None:
        if active_template_ids:
            raise SalesOrderItemError(
                "Routing template is required when the selected model has active "
                "routing whitelist links"
            )
        return None, None

    link = model_routing_repo.get_link_by_template(
        db, product_model_id, routing_template_id
    )
    if link is None:
        raise SalesOrderItemError(
            "Routing template is not in the product model routing whitelist"
        )
    if not link.is_active and routing_template_id != current_routing_template_id:
        raise SalesOrderItemError(
            "Inactive routing whitelist link cannot be selected"
        )

    template = shop_routing_repo.get_routing_template(db, routing_template_id)
    if template is None:
        raise SalesOrderItemError("Routing template not found")
    if not template.is_active and routing_template_id != current_routing_template_id:
        raise SalesOrderItemError("Inactive routing template cannot be selected")

    return template.id, template.name


def _resolve_model_and_assembly(
    db: Session,
    *,
    nomenclature_id: int | None,
    product_model_id: int | None,
    assembly_variant_id: int | None,
    routing_template_id: int | None,
    current_product_model_id: int | None = None,
    current_assembly_variant_id: int | None = None,
    current_routing_template_id: int | None = None,
) -> _ResolvedModelAssembly:
    """Bind PRODUCT whitelist model + assembly + routing; server fills immutable snapshots."""
    if product_model_id is None and assembly_variant_id is None:
        if routing_template_id is not None:
            raise SalesOrderItemError(
                "Routing template selection requires a product model"
            )
        if nomenclature_id is not None:
            nomenclature = db.get(Nomenclature, nomenclature_id)
            if nomenclature is None:
                raise SalesOrderItemError("Nomenclature not found")
            if nomenclature.nomenclature_type == NomenclatureType.PRODUCT:
                whitelist = nomenclature_model_repo.list_links_for_nomenclature(
                    db, nomenclature_id
                )
                if whitelist:
                    raise SalesOrderItemError(
                        "Product model is required when the PRODUCT available-models list is not empty"
                    )
        return _EMPTY_MODEL_ASSEMBLY

    if nomenclature_id is None:
        raise SalesOrderItemError(
            "Product model selection requires a PRODUCT nomenclature on the order item"
        )

    nomenclature = db.get(Nomenclature, nomenclature_id)
    if nomenclature is None:
        raise SalesOrderItemError("Nomenclature not found")
    if nomenclature.nomenclature_type != NomenclatureType.PRODUCT:
        raise SalesOrderItemError(
            "Product model selection is allowed only for PRODUCT nomenclature"
        )

    whitelist = nomenclature_model_repo.list_links_for_nomenclature(db, nomenclature_id)
    whitelist_ids = {link.product_model_id for link, _model in whitelist}

    if product_model_id is None:
        raise SalesOrderItemError("Assembly variant requires a product model")

    model = db.get(ProductModel, product_model_id)
    if model is None:
        raise SalesOrderItemError("Product model not found")
    if whitelist and product_model_id not in whitelist_ids:
        raise SalesOrderItemError("Product model is not in the PRODUCT available-models list")
    if model.status != ProductModelStatus.ACTIVE and product_model_id != current_product_model_id:
        raise SalesOrderItemError("Inactive product model cannot be selected")

    size_type = model.size_type.value if hasattr(model.size_type, "value") else str(model.size_type)

    routing_id, routing_name = _resolve_routing_snapshot(
        db,
        product_model_id=model.id,
        routing_template_id=routing_template_id,
        current_routing_template_id=current_routing_template_id,
    )

    if assembly_variant_id is None:
        if _active_variant_count(db, model.id) >= 1:
            raise SalesOrderItemError(
                "Assembly variant is required when the selected model has active variants"
            )
        return _ResolvedModelAssembly(
            product_model_id=model.id,
            product_model_article=model.article,
            product_model_name=model.name,
            product_model_size_type=size_type,
            assembly_variant_id=None,
            assembly_variant_name=None,
            assembly_variant_total_cost=None,
            routing_template_id=routing_id,
            routing_template_name=routing_name,
            operation_snapshots=(),
        )

    variant = assembly_repo.get_variant(db, assembly_variant_id)
    if variant is None or variant.product_model_id != model.id:
        raise SalesOrderItemError("Assembly variant not found for the selected product model")
    if not variant.is_active and assembly_variant_id != current_assembly_variant_id:
        raise SalesOrderItemError("Inactive assembly variant cannot be selected")

    return _ResolvedModelAssembly(
        product_model_id=model.id,
        product_model_article=model.article,
        product_model_name=model.name,
        product_model_size_type=size_type,
        assembly_variant_id=variant.id,
        assembly_variant_name=variant.name,
        assembly_variant_total_cost=_money(assembly_repo.variant_total_cost(variant)),
        routing_template_id=routing_id,
        routing_template_name=routing_name,
        operation_snapshots=_operation_snapshot_rows(variant),
    )


def _apply_model_assembly(item: SalesOrderItem, binding: _ResolvedModelAssembly) -> None:
    item.product_model_id = binding.product_model_id
    item.product_model_article = binding.product_model_article
    item.product_model_name = binding.product_model_name
    item.product_model_size_type = binding.product_model_size_type
    item.assembly_variant_id = binding.assembly_variant_id
    item.assembly_variant_name = binding.assembly_variant_name
    item.assembly_variant_total_cost = binding.assembly_variant_total_cost
    item.routing_template_id = binding.routing_template_id
    item.routing_template_name = binding.routing_template_name


def create_sales_order_item(
    db: Session,
    order_id: int,
    payload: SalesOrderItemCreate,
) -> SalesOrderItem:
    order = _get_order(db, order_id)
    _validate_nomenclature(db, payload.nomenclature_id)
    _validate_nomenclature_variant(db, payload.nomenclature_id, payload.nomenclature_variant_id)
    vat_rate_id, vat_rate_percent = _resolve_vat_rate(db, payload.vat_rate_id)
    binding = _resolve_model_and_assembly(
        db,
        nomenclature_id=payload.nomenclature_id,
        product_model_id=payload.product_model_id,
        assembly_variant_id=payload.assembly_variant_id,
        routing_template_id=payload.routing_template_id,
    )
    position = max((item.position for item in order.items), default=0) + 1
    _, discount_amount, line_amount = calculate_sales_order_item_totals(
        payload.quantity, payload.unit_price, payload.discount_percent
    )
    item = SalesOrderItem(
        order=order,
        position=position,
        nomenclature_id=payload.nomenclature_id,
        nomenclature_variant_id=payload.nomenclature_variant_id,
        product_model_id=binding.product_model_id,
        product_model_article=binding.product_model_article,
        product_model_name=binding.product_model_name,
        product_model_size_type=binding.product_model_size_type,
        assembly_variant_id=binding.assembly_variant_id,
        assembly_variant_name=binding.assembly_variant_name,
        assembly_variant_total_cost=binding.assembly_variant_total_cost,
        routing_template_id=binding.routing_template_id,
        routing_template_name=binding.routing_template_name,
        vat_rate_id=vat_rate_id,
        vat_rate_percent=vat_rate_percent,
        price_includes_vat=payload.price_includes_vat,
        vat_amount=Decimal("0.00"),
        snapshot_name=payload.snapshot_name.strip(),
        size_range=payload.size_range.strip() if payload.size_range else None,
        personalization=payload.personalization.strip() if payload.personalization else None,
        color=payload.color.strip() if payload.color else None,
        unit=payload.unit.strip(),
        quantity=payload.quantity,
        unit_price=payload.unit_price,
        discount_percent=payload.discount_percent,
        discount_amount=discount_amount,
        line_amount=line_amount,
    )
    db.add(item)
    db.flush()
    _replace_variant_snapshots(db, item)
    _replace_assembly_operation_snapshots(db, item, binding.operation_snapshots)
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

    nomenclature_changed = "nomenclature_id" in changes
    if nomenclature_changed:
        _validate_nomenclature(db, changes["nomenclature_id"])
        # Safe default: nomenclature change clears pattern-model binding
        if "product_model_id" not in changes:
            changes["product_model_id"] = None
        if "assembly_variant_id" not in changes:
            changes["assembly_variant_id"] = None
        if "routing_template_id" not in changes:
            changes["routing_template_id"] = None

    if "nomenclature_variant_id" in changes:
        _validate_nomenclature_variant(
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

    if "price_includes_vat" in changes:
        item.price_includes_vat = bool(changes["price_includes_vat"])

    if "nomenclature_id" in changes and "nomenclature_variant_id" not in changes:
        _validate_nomenclature_variant(db, item.nomenclature_id, item.nomenclature_variant_id)

    model_fields_touched = (
        "product_model_id" in changes
        or "assembly_variant_id" in changes
        or "routing_template_id" in changes
        or nomenclature_changed
    )
    if model_fields_touched:
        product_model_id = (
            changes["product_model_id"] if "product_model_id" in changes else item.product_model_id
        )
        assembly_variant_id = (
            changes["assembly_variant_id"]
            if "assembly_variant_id" in changes
            else item.assembly_variant_id
        )
        routing_template_id = (
            changes["routing_template_id"]
            if "routing_template_id" in changes
            else item.routing_template_id
        )
        if "product_model_id" in changes and changes["product_model_id"] != item.product_model_id:
            # Model change invalidates previous variant/routing unless client sent new ones
            if "assembly_variant_id" not in changes:
                assembly_variant_id = None
            if "routing_template_id" not in changes:
                routing_template_id = None
        binding = _resolve_model_and_assembly(
            db,
            nomenclature_id=item.nomenclature_id,
            product_model_id=product_model_id,
            assembly_variant_id=assembly_variant_id,
            routing_template_id=routing_template_id,
            current_product_model_id=item.product_model_id,
            current_assembly_variant_id=item.assembly_variant_id,
            current_routing_template_id=item.routing_template_id,
        )
        _apply_model_assembly(item, binding)
        db.flush()
        _replace_assembly_operation_snapshots(db, item, binding.operation_snapshots)

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
