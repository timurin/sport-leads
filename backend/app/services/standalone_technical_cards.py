"""Standalone technical cards (contour B, Stage 28.2 / SL-STANDALONE-TC-v1)."""

from __future__ import annotations

from datetime import date
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.nomenclature import Nomenclature, NomenclatureType
from app.models.sales import SalesOrderItem
from app.models.technical_card import (
    TechnicalCard,
    TechnicalCardOrderGroup,
    TechnicalCardStatus,
    TechnicalCardUnitLine,
)
from app.schemas.technical_card import (
    TechnicalCardOrderGroupUpdate,
    TechnicalCardStandaloneCreate,
)
from app.services.technical_card_settings import get_technical_card_settings
from app.services.technical_cards import (
    TechnicalCardConflictError,
    TechnicalCardNotFoundError,
    TechnicalCardValidationError,
    _next_card_seq,
    _technical_card_number,
    get_technical_card,
    is_eligible_order_item,
    unit_line_count_from_quantity,
)


def _nomenclature_type_value(nomenclature: Nomenclature) -> str:
    raw = nomenclature.nomenclature_type
    return raw.value if isinstance(raw, NomenclatureType) else str(raw)


def _next_group_card_seq(db: Session, order_group_id: int) -> int:
    current = db.scalar(
        select(func.max(TechnicalCard.card_seq)).where(
            TechnicalCard.order_group_id == order_group_id
        )
    )
    return int(current or 0) + 1


def _get_or_create_order_group(
    db: Session,
    *,
    order_number: str,
    planned_count: int,
    desired_date: date,
) -> TechnicalCardOrderGroup:
    existing = db.scalar(
        select(TechnicalCardOrderGroup).where(
            TechnicalCardOrderGroup.order_number == order_number
        )
    )
    if existing is not None:
        return existing
    group = TechnicalCardOrderGroup(
        order_number=order_number,
        tech_cards_planned_count=planned_count,
        desired_date=desired_date,
    )
    db.add(group)
    db.flush()
    return group


def _blank_unit_line(unit_index: int) -> TechnicalCardUnitLine:
    return TechnicalCardUnitLine(
        unit_index=unit_index,
        size_type=None,
        size=None,
        personalization=None,
        print_number=None,
        notes=None,
    )


def create_standalone_technical_card(
    db: Session,
    payload: TechnicalCardStandaloneCreate,
    *,
    created_by_platform_user_id: int | None = None,
) -> TechnicalCard:
    order_number = payload.order_number.strip()
    if not order_number:
        raise TechnicalCardValidationError("order_number is required")

    nomenclature = db.get(Nomenclature, payload.nomenclature_id)
    if nomenclature is None:
        raise TechnicalCardNotFoundError("Nomenclature not found")
    if not nomenclature.is_active:
        raise TechnicalCardValidationError("Nomenclature is inactive")

    settings = get_technical_card_settings(db)
    allowed_types = {
        value.value if hasattr(value, "value") else str(value)
        for value in settings.eligible_nomenclature_types
    }
    nomenclature_type = _nomenclature_type_value(nomenclature)
    if nomenclature_type not in allowed_types:
        raise TechnicalCardValidationError(
            f"nomenclature_type_not_allowed:{nomenclature_type.lower()}"
        )

    unit_count = unit_line_count_from_quantity(payload.quantity)
    group = _get_or_create_order_group(
        db,
        order_number=order_number,
        planned_count=payload.tech_cards_planned_count,
        desired_date=payload.desired_date,
    )
    card_seq = _next_group_card_seq(db, group.id)
    number = _technical_card_number(
        group.order_number, card_seq, settings.numbering_template
    )
    taken = db.scalar(select(TechnicalCard.id).where(TechnicalCard.number == number))
    if taken is not None:
        raise TechnicalCardValidationError(
            f"Technical card number {number} already exists"
        )

    card = TechnicalCard(
        sales_order_id=None,
        sales_order_item_id=None,
        order_group_id=group.id,
        number=number,
        card_seq=card_seq,
        status=TechnicalCardStatus.DRAFT,
        quantity=Decimal(payload.quantity),
        nomenclature_id=nomenclature.id,
        nomenclature_name=nomenclature.name,
        nomenclature_type=nomenclature_type,
        created_by_platform_user_id=created_by_platform_user_id,
        unit_lines=[],
        composition_lines=[],
        operation_lines=[],
        stage_results=[],
    )
    for index in range(1, unit_count + 1):
        card.unit_lines.append(_blank_unit_line(index))
    db.add(card)
    try:
        db.flush()
    except IntegrityError as error:
        raise TechnicalCardValidationError(
            "Could not create standalone technical card"
        ) from error
    from app.services.tech_card_qr import ensure_qr_token

    ensure_qr_token(db, card)
    db.flush()
    from app.services.tech_card_model_assembly import seed_card_from_nomenclature

    seed_card_from_nomenclature(db, card)
    db.flush()
    return get_technical_card(db, card.id)


def get_technical_card_order_group(
    db: Session, group_id: int
) -> TechnicalCardOrderGroup:
    group = db.get(TechnicalCardOrderGroup, group_id)
    if group is None:
        raise TechnicalCardNotFoundError("Technical card order group not found")
    return group


def update_technical_card_order_group(
    db: Session, group_id: int, payload: TechnicalCardOrderGroupUpdate
) -> TechnicalCardOrderGroup:
    group = get_technical_card_order_group(db, group_id)
    if payload.tech_cards_planned_count is not None:
        group.tech_cards_planned_count = payload.tech_cards_planned_count
    if payload.desired_date is not None:
        group.desired_date = payload.desired_date
    if payload.order_number is not None:
        next_number = payload.order_number.strip()
        if not next_number:
            raise TechnicalCardValidationError("Укажите номер заказа")
        taken = db.scalar(
            select(TechnicalCardOrderGroup.id).where(
                TechnicalCardOrderGroup.order_number == next_number,
                TechnicalCardOrderGroup.id != group.id,
            )
        )
        if taken is not None:
            raise TechnicalCardConflictError("Номер заказа уже занят другой группой")
        group.order_number = next_number
    db.flush()
    return group


def link_standalone_technical_card(
    db: Session,
    card_id: int,
    *,
    sales_order_item_id: int,
) -> TechnicalCard:
    """Convert contour B → A onto a free eligible SalesOrderItem (`28.5.1`)."""
    card = get_technical_card(db, card_id)
    if card.sales_order_id is not None or card.sales_order_item_id is not None:
        raise TechnicalCardValidationError(
            "Техкарта уже привязана к заказу покупателя"
        )
    if card.order_group_id is None:
        raise TechnicalCardValidationError(
            "Привязать можно только самостоятельную техкарту"
        )

    item = db.get(SalesOrderItem, sales_order_item_id)
    if item is None:
        raise TechnicalCardNotFoundError("Позиция заказа не найдена")

    eligible, skip_reason = is_eligible_order_item(db, item)
    if not eligible:
        raise TechnicalCardValidationError(
            skip_reason or "Позиция заказа не подходит для техкарты"
        )

    if (
        card.nomenclature_id is not None
        and item.nomenclature_id is not None
        and card.nomenclature_id != item.nomenclature_id
    ):
        raise TechnicalCardValidationError(
            "Номенклатура позиции не совпадает с техкартой"
        )

    occupied = db.scalar(
        select(TechnicalCard.id).where(
            TechnicalCard.sales_order_item_id == item.id
        )
    )
    if occupied is not None:
        raise TechnicalCardConflictError(
            "У этой позиции заказа уже есть техкарта"
        )

    stored_number = card.number
    next_seq = _next_card_seq(db, item.order_id)
    card.sales_order_id = item.order_id
    card.sales_order_item_id = item.id
    card.order_group_id = None
    card.card_seq = next_seq
    card.number = stored_number
    try:
        db.flush()
    except IntegrityError as error:
        db.rollback()
        raise TechnicalCardConflictError(
            "Не удалось привязать техкарту к позиции заказа"
        ) from error
    return get_technical_card(db, card.id)
