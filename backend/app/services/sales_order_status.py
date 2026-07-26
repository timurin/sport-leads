from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.sales import LeadEvent, LeadEventType, SalesOrder, SalesOrderStatus
from app.services.order_manufacturing_completeness import (
    OrderManufacturingIncompleteError,
    require_manufacturing_complete_for_status,
)


class SalesOrderNotFoundError(RuntimeError):
    pass


class InvalidSalesOrderStatusTransition(RuntimeError):
    pass


_STATUS_ORDER = {
    SalesOrderStatus.NEW: 0,
    SalesOrderStatus.CONFIRMED: 1,
    SalesOrderStatus.PRODUCTION: 2,
    SalesOrderStatus.READY: 3,
    SalesOrderStatus.SHIPPED: 4,
    SalesOrderStatus.COMPLETED: 5,
}

# Production-complete gates for Stage 3.4.2 / 9.5: READY+ means shop work done.
# Reserve / payment / shipping docs in 3.4.2 must reuse the same helper.
_REQUIRES_MANUFACTURING_COMPLETE = frozenset(
    {
        SalesOrderStatus.READY,
        SalesOrderStatus.SHIPPED,
        SalesOrderStatus.COMPLETED,
    }
)


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

    current_status = order.status
    if current_status == status:
        return order
    if current_status in {SalesOrderStatus.COMPLETED, SalesOrderStatus.CANCELLED}:
        raise InvalidSalesOrderStatusTransition(
            f"Cannot change status from {current_status.value}"
        )
    if status != SalesOrderStatus.CANCELLED and (
        status not in _STATUS_ORDER
        or _STATUS_ORDER[status] < _STATUS_ORDER[current_status]
    ):
        raise InvalidSalesOrderStatusTransition(
            f"Cannot change status from {current_status.value} to {status.value}"
        )

    if status in _REQUIRES_MANUFACTURING_COMPLETE:
        try:
            require_manufacturing_complete_for_status(
                db, order_id, target_label=status.value
            )
        except OrderManufacturingIncompleteError as error:
            raise InvalidSalesOrderStatusTransition(str(error)) from error

    order.status = status
    db.add(
        LeadEvent(
            lead_id=order.lead_id,
            order_id=order.id,
            event_type=LeadEventType.ORDER_STATUS_CHANGED,
            message=f"Order status changed: {current_status.value} → {status.value}",
        )
    )
    db.flush()
    return order
