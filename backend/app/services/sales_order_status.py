from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.sales import SalesOrder, SalesOrderStatus


class SalesOrderNotFoundError(RuntimeError):
    pass


def update_sales_order_status(
    db: Session,
    order_id: int,
    status: SalesOrderStatus,
) -> SalesOrder:
    order = db.scalar(
        select(SalesOrder).where(SalesOrder.id == order_id).with_for_update()
    )
    if order is None:
        raise SalesOrderNotFoundError("Order not found")

    order.status = status
    db.flush()
    return order
