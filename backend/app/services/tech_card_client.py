"""Tech-card client on SalesOrder or standalone order group (Stage 26.3.7)."""

from __future__ import annotations

from collections.abc import Iterable

from sqlalchemy import case, select
from sqlalchemy.orm import Session

from app.models.sales import Client, SalesOrder
from app.models.technical_card import (
    TechnicalCard,
    TechnicalCardOrderGroup,
    TechnicalCardStatus,
)
from app.services.sales_order_client import SalesOrderClientError, update_sales_order_client


def client_display_name(client: Client) -> str:
    return (client.company_name or "").strip() or client.contact_name


def technical_card_clients(
    db: Session, card_ids: Iterable[int],
) -> dict[int, tuple[int | None, str | None]]:
    """Resolve parent-owned Client IDs and live names in one bounded query."""
    ids = set(card_ids)
    if not ids:
        return {}
    client_id = case(
        (TechnicalCard.sales_order_id.is_not(None), SalesOrder.client_id),
        else_=TechnicalCardOrderGroup.client_id,
    )
    rows = db.execute(
        select(TechnicalCard.id, client_id, Client)
        .outerjoin(SalesOrder, SalesOrder.id == TechnicalCard.sales_order_id)
        .outerjoin(TechnicalCardOrderGroup, TechnicalCardOrderGroup.id == TechnicalCard.order_group_id)
        .outerjoin(Client, Client.id == client_id)
        .where(TechnicalCard.id.in_(ids))
    ).all()
    return {
        card_id: (owner_client_id, client_display_name(client) if client is not None else None)
        for card_id, owner_client_id, client in rows
    }


def update_technical_card_client(
    db: Session,
    card_id: int,
    *,
    client_id: int | None,
) -> TechnicalCard:
    from app.services.technical_cards import TechnicalCardNotFoundError, TechnicalCardValidationError

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
        try:
            update_sales_order_client(db, card.sales_order_id, client.id)
        except SalesOrderClientError as error:
            raise TechnicalCardNotFoundError(str(error)) from error
        return card
    if card.order_group_id is None:
        raise TechnicalCardValidationError("Техкарта без заказа и группы")
    group = db.scalar(select(TechnicalCardOrderGroup).where(
        TechnicalCardOrderGroup.id == card.order_group_id,
    ).with_for_update())
    if group is None:
        raise TechnicalCardNotFoundError("Order group not found")
    group.client_id = client.id if client is not None else None
    db.flush()
    return card
