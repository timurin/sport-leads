"""Tech-card client on SalesOrder or standalone order group (Stage 26.3.7)."""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.sales import Client, SalesOrder
from app.models.technical_card import (
    TechnicalCard,
    TechnicalCardOrderGroup,
    TechnicalCardStatus,
)
from app.services.technical_cards import (
    TechnicalCardNotFoundError,
    TechnicalCardValidationError,
)


def client_display_name(client: Client) -> str:
    return (client.company_name or "").strip() or client.contact_name


def update_technical_card_client(
    db: Session,
    card_id: int,
    *,
    client_id: int | None,
) -> TechnicalCard:
    card = db.get(TechnicalCard, card_id)
    if card is None:
        raise TechnicalCardNotFoundError("Technical card not found")
    if card.status == TechnicalCardStatus.CANCELLED:
        raise TechnicalCardValidationError(
            "Нельзя менять клиента на отменённой техкарте"
        )
    client: Client | None = None
    if client_id is not None:
        client = db.get(Client, client_id)
        if client is None:
            raise TechnicalCardNotFoundError("Клиент не найден")
    if card.sales_order_id is not None:
        if client is None:
            raise TechnicalCardValidationError(
                "Клиент обязателен для техкарты по заказу"
            )
        order = db.get(SalesOrder, card.sales_order_id)
        if order is None:
            raise TechnicalCardNotFoundError("Order not found")
        order.client_id = client.id
        db.flush()
        return card
    if card.order_group_id is None:
        raise TechnicalCardValidationError("Техкарта без заказа и группы")
    group = db.get(TechnicalCardOrderGroup, card.order_group_id)
    if group is None:
        raise TechnicalCardNotFoundError("Order group not found")
    group.client_id = client.id if client is not None else None
    db.flush()
    return card
