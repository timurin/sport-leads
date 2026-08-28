"""Tech-card due date on SalesOrder or standalone order group (Stage 26.3.8)."""

from __future__ import annotations

from datetime import date

from sqlalchemy.orm import Session

from app.models.sales import SalesOrder
from app.models.technical_card import (
    TechnicalCard,
    TechnicalCardOrderGroup,
    TechnicalCardStatus,
)
from app.services.technical_cards import (
    TechnicalCardNotFoundError,
    TechnicalCardValidationError,
)


def update_technical_card_desired_date(
    db: Session,
    card_id: int,
    *,
    desired_date: date | None,
) -> TechnicalCard:
    card = db.get(TechnicalCard, card_id)
    if card is None:
        raise TechnicalCardNotFoundError("Technical card not found")
    if card.status == TechnicalCardStatus.CANCELLED:
        raise TechnicalCardValidationError(
            "Нельзя менять дату сдачи на отменённой техкарте"
        )
    if card.sales_order_id is not None:
        order = db.get(SalesOrder, card.sales_order_id)
        if order is None:
            raise TechnicalCardNotFoundError("Order not found")
        order.desired_date = desired_date
        db.flush()
        return card
    if card.order_group_id is None:
        raise TechnicalCardValidationError("Техкарта без заказа и группы")
    if desired_date is None:
        raise TechnicalCardValidationError(
            "Дата сдачи обязательна для самостоятельной техкарты"
        )
    group = db.get(TechnicalCardOrderGroup, card.order_group_id)
    if group is None:
        raise TechnicalCardNotFoundError("Order group not found")
    group.desired_date = desired_date
    db.flush()
    return card
