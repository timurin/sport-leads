from __future__ import annotations

from typing import Literal

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.models.sales import Client, Lead, SalesOrder
from app.schemas.client_history import ClientHistoryItem, ClientHistoryRead
from app.services.lead_duplicates import (
    LeadDuplicateCriteriaError,
    find_duplicate_leads,
)

HistoryKind = Literal["all", "lead", "order"]


class ClientHistoryNotFoundError(RuntimeError):
    pass


def list_client_history(
    db: Session,
    client_id: int,
    *,
    kind: HistoryKind = "all",
    limit: int = 50,
    offset: int = 0,
) -> ClientHistoryRead:
    client = db.get(Client, client_id)
    if client is None:
        raise ClientHistoryNotFoundError("Client not found")

    orders = list(
        db.scalars(
            select(SalesOrder)
            .where(SalesOrder.client_id == client_id)
            .order_by(SalesOrder.created_at.desc(), SalesOrder.id.desc())
        ).all()
    )
    order_ids = [order.id for order in orders]
    lead_ids_from_orders = [order.lead_id for order in orders if order.lead_id is not None]

    lead_conditions = []
    if lead_ids_from_orders:
        lead_conditions.append(Lead.id.in_(lead_ids_from_orders))
    if order_ids:
        lead_conditions.append(Lead.converted_order_id.in_(order_ids))

    leads_by_id: dict[int, Lead] = {}
    if lead_conditions:
        for lead in db.scalars(select(Lead).where(or_(*lead_conditions))).all():
            leads_by_id[lead.id] = lead

    try:
        matched = find_duplicate_leads(
            db,
            phone=client.phone,
            email=client.email,
            limit=50,
        )
    except LeadDuplicateCriteriaError:
        matched = []
    for lead in matched:
        leads_by_id[lead.id] = lead

    items: list[ClientHistoryItem] = []
    if kind in {"all", "order"}:
        items.extend(
            ClientHistoryItem(
                kind="order",
                id=order.id,
                occurred_at=order.created_at,
                title=f"{order.number} · {order.title}".strip(" ·"),
                status=order.status.value if hasattr(order.status, "value") else str(order.status),
                amount=order.amount,
                sport=order.sport,
                source=None,
            )
            for order in orders
        )
    if kind in {"all", "lead"}:
        items.extend(
            ClientHistoryItem(
                kind="lead",
                id=lead.id,
                occurred_at=lead.created_at,
                title=(
                    lead.need_description
                    or lead.company_name
                    or lead.contact_name
                    or f"Лид #{lead.id}"
                ),
                status=lead.status,
                amount=None,
                sport=lead.sport,
                source=lead.source,
            )
            for lead in leads_by_id.values()
        )

    items.sort(key=lambda item: (item.occurred_at, item.kind, item.id), reverse=True)
    total = len(items)
    return ClientHistoryRead(items=items[offset : offset + limit], total=total)
