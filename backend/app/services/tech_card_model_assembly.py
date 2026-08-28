"""Tech-card product model + assembly snapshots (Stage 26.3.9)."""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.product_model import ProductModel, ProductModelStatus
from app.models.sales import SalesOrderItem
from app.models.technical_card import TechnicalCard, TechnicalCardStatus
from app.repositories import assembly_variants as assembly_repo
from app.services.sales_order_items import (
    _operation_snapshot_rows,
    _replace_assembly_operation_snapshots,
)
from app.services.technical_cards import (
    TechnicalCardNotFoundError,
    TechnicalCardValidationError,
    _sync_sewing_operation_lines,
)


def update_technical_card_model_assembly(
    db: Session,
    card_id: int,
    *,
    product_model_id: int | None,
    assembly_variant_id: int | None,
) -> TechnicalCard:
    card = db.get(TechnicalCard, card_id)
    if card is None:
        raise TechnicalCardNotFoundError("Technical card not found")
    if card.status == TechnicalCardStatus.CANCELLED:
        raise TechnicalCardValidationError(
            "Нельзя менять модель на отменённой техкарте"
        )
    if assembly_variant_id is not None and product_model_id is None:
        raise TechnicalCardValidationError("Сборка требует выбранную модель")

    model: ProductModel | None = None
    if product_model_id is not None:
        model = db.get(ProductModel, product_model_id)
        if model is None:
            raise TechnicalCardNotFoundError("Модель изделия не найдена")
        if (
            model.status != ProductModelStatus.ACTIVE
            and product_model_id != card.product_model_id
        ):
            raise TechnicalCardValidationError(
                "Нельзя выбрать неактивную модель изделия"
            )

    variant = None
    if assembly_variant_id is not None:
        variant = assembly_repo.get_variant(db, assembly_variant_id)
        if variant is None or model is None or variant.product_model_id != model.id:
            raise TechnicalCardValidationError(
                "Сборка не относится к выбранной модели"
            )
        if not variant.is_active and assembly_variant_id != card.assembly_variant_id:
            raise TechnicalCardValidationError("Нельзя выбрать неактивную сборку")

    if model is None:
        card.product_model_id = None
        card.product_model_article = None
        card.product_model_name = None
        card.product_model_size_type = None
        card.assembly_variant_id = None
        card.assembly_variant_name = None
        card.assembly_variant_total_cost = None
    else:
        size_type = (
            model.size_type.value
            if hasattr(model.size_type, "value")
            else str(model.size_type)
        )
        card.product_model_id = model.id
        card.product_model_article = model.article
        card.product_model_name = model.name
        card.product_model_size_type = size_type
        if variant is None:
            card.assembly_variant_id = None
            card.assembly_variant_name = None
            card.assembly_variant_total_cost = None
        else:
            card.assembly_variant_id = variant.id
            card.assembly_variant_name = variant.name
            card.assembly_variant_total_cost = assembly_repo.variant_total_cost(variant)

    if card.sales_order_item_id is not None:
        item = db.get(SalesOrderItem, card.sales_order_item_id)
        if item is None:
            raise TechnicalCardNotFoundError("Позиция заказа не найдена")
        item.product_model_id = card.product_model_id
        item.product_model_article = card.product_model_article
        item.product_model_name = card.product_model_name
        item.product_model_size_type = card.product_model_size_type
        item.assembly_variant_id = card.assembly_variant_id
        item.assembly_variant_name = card.assembly_variant_name
        item.assembly_variant_total_cost = card.assembly_variant_total_cost
        _replace_assembly_operation_snapshots(
            db,
            item,
            _operation_snapshot_rows(variant) if variant is not None else (),
        )

    db.flush()
    _sync_sewing_operation_lines(db, card)
    db.flush()
    return card
