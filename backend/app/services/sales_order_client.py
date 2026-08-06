from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.sales import Client, SalesOrder


class SalesOrderClientError(RuntimeError):
    pass


def update_sales_order_client(
    db: Session,
    order_id: int,
    client_id: int,
) -> SalesOrder:
    order = db.scalar(select(SalesOrder).where(SalesOrder.id == order_id).with_for_update())
    if order is None:
        raise SalesOrderClientError("Order not found")
    client = db.scalar(
        select(Client).where(
            Client.id == client_id,
            Client.is_active.is_(True),
        )
    )
    if client is None:
        raise SalesOrderClientError("Active client not found")
    order.client_id = client_id
    db.flush()
    return order
