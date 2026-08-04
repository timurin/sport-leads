"""Client list/detail reads for Stage 2.2.1 / 2.2.2 workspace."""

from __future__ import annotations

from decimal import Decimal

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.models.sales import Client, SalesOrder, SalesUser
from app.schemas.sales import ClientDetailRead, ClientListItem, ClientOrderSummary


def _orders_agg_subquery():
    return (
        select(
            SalesOrder.client_id.label("client_id"),
            func.count(SalesOrder.id).label("orders_count"),
            func.coalesce(func.sum(SalesOrder.amount), 0).label("sales_amount"),
            func.max(SalesOrder.sport).label("primary_sport"),
        )
        .group_by(SalesOrder.client_id)
        .subquery()
    )


def _to_list_item(
    client: Client,
    responsible_name: str | None,
    orders_count: object,
    sales_amount: object,
    primary_sport: str | None,
) -> ClientListItem:
    amount = sales_amount if isinstance(sales_amount, Decimal) else Decimal(str(sales_amount or 0))
    return ClientListItem(
        id=client.id,
        company_name=client.company_name,
        contact_name=client.contact_name,
        phone=client.phone,
        email=str(client.email) if client.email is not None else None,
        city=client.city,
        responsible_id=client.responsible_id,
        responsible_name=responsible_name,
        orders_count=int(orders_count or 0),
        sales_amount=amount,
        primary_sport=primary_sport,
        created_at=client.created_at,
        updated_at=client.updated_at,
    )


def list_clients(
    db: Session,
    *,
    q: str | None = None,
    responsible_id: int | None = None,
    limit: int = 500,
    offset: int = 0,
) -> list[ClientListItem]:
    orders_agg = _orders_agg_subquery()

    statement = (
        select(
            Client,
            SalesUser.name.label("responsible_name"),
            func.coalesce(orders_agg.c.orders_count, 0).label("orders_count"),
            func.coalesce(orders_agg.c.sales_amount, 0).label("sales_amount"),
            orders_agg.c.primary_sport,
        )
        .outerjoin(SalesUser, SalesUser.id == Client.responsible_id)
        .outerjoin(orders_agg, orders_agg.c.client_id == Client.id)
        .order_by(
            func.coalesce(Client.company_name, Client.contact_name),
            Client.contact_name,
            Client.id,
        )
        .offset(offset)
        .limit(limit)
    )

    if responsible_id is not None:
        statement = statement.where(Client.responsible_id == responsible_id)

    if q:
        needle = f"%{q.strip()}%"
        statement = statement.where(
            or_(
                Client.company_name.ilike(needle),
                Client.contact_name.ilike(needle),
                Client.phone.ilike(needle),
                Client.email.ilike(needle),
                Client.city.ilike(needle),
            )
        )

    rows = db.execute(statement).all()
    return [
        _to_list_item(client, responsible_name, orders_count, sales_amount, primary_sport)
        for client, responsible_name, orders_count, sales_amount, primary_sport in rows
    ]


def get_client(db: Session, client_id: int) -> ClientDetailRead | None:
    orders_agg = _orders_agg_subquery()
    row = db.execute(
        select(
            Client,
            SalesUser.name.label("responsible_name"),
            func.coalesce(orders_agg.c.orders_count, 0).label("orders_count"),
            func.coalesce(orders_agg.c.sales_amount, 0).label("sales_amount"),
            orders_agg.c.primary_sport,
        )
        .outerjoin(SalesUser, SalesUser.id == Client.responsible_id)
        .outerjoin(orders_agg, orders_agg.c.client_id == Client.id)
        .where(Client.id == client_id)
    ).one_or_none()
    if row is None:
        return None

    client, responsible_name, orders_count, sales_amount, primary_sport = row
    base = _to_list_item(client, responsible_name, orders_count, sales_amount, primary_sport)

    orders = db.scalars(
        select(SalesOrder)
        .where(SalesOrder.client_id == client_id)
        .order_by(SalesOrder.created_at.desc(), SalesOrder.id.desc())
        .limit(20)
    ).all()
    recent_orders = [
        ClientOrderSummary(
            id=order.id,
            number=order.number,
            title=order.title,
            status=order.status,
            amount=order.amount,
            sport=order.sport,
            created_at=order.created_at,
        )
        for order in orders
    ]
    return ClientDetailRead(**base.model_dump(), recent_orders=recent_orders)
