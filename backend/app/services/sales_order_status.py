from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.sales import (
    DesignApprovalStatus,
    LeadEvent,
    LeadEventType,
    MaterialReserveStatus,
    OrderPaymentStatus,
    SalesOrder,
    SalesOrderStatus,
)
from app.services.order_manufacturing_completeness import (
    OrderManufacturingIncompleteError,
    require_manufacturing_complete_for_status,
)


class SalesOrderNotFoundError(RuntimeError):
    pass


class InvalidSalesOrderStatusTransition(RuntimeError):
    pass


class InvalidSalesOrderPaymentUpdate(RuntimeError):
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
# Warehouse reserve / payment ledger / shipping docs stay Stage 12 / 14.
_REQUIRES_MANUFACTURING_COMPLETE = frozenset(
    {
        SalesOrderStatus.READY,
        SalesOrderStatus.SHIPPED,
        SalesOrderStatus.COMPLETED,
    }
)

_DESIGN_ALLOWS_PRODUCTION = frozenset(
    {
        DesignApprovalStatus.NOT_REQUIRED,
        DesignApprovalStatus.APPROVED,
    }
)


def derive_payment_status(
    paid_amount: object,
    order_amount: object | None,
) -> OrderPaymentStatus:
    paid = paid_amount if isinstance(paid_amount, Decimal) else Decimal(str(paid_amount))
    if paid <= 0:
        return OrderPaymentStatus.UNPAID
    if order_amount is None:
        return OrderPaymentStatus.PARTIAL
    amount = (
        order_amount
        if isinstance(order_amount, Decimal)
        else Decimal(str(order_amount))
    )
    if amount <= 0:
        return OrderPaymentStatus.PAID if paid > 0 else OrderPaymentStatus.UNPAID
    if paid >= amount:
        return OrderPaymentStatus.PAID
    return OrderPaymentStatus.PARTIAL


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

    if status == SalesOrderStatus.PRODUCTION and (
        order.design_approval_status not in _DESIGN_ALLOWS_PRODUCTION
    ):
        raise InvalidSalesOrderStatusTransition(
            "Нельзя перевести в производство: дизайн не согласован "
            f"(сейчас: {order.design_approval_status.value}). "
            "Установите «Согласован» или «Не требуется»."
        )

    if status in _REQUIRES_MANUFACTURING_COMPLETE:
        try:
            require_manufacturing_complete_for_status(
                db, order_id, target_label=status.value
            )
        except OrderManufacturingIncompleteError as error:
            raise InvalidSalesOrderStatusTransition(str(error)) from error

    if status == SalesOrderStatus.COMPLETED and (
        order.payment_status != OrderPaymentStatus.PAID
    ):
        raise InvalidSalesOrderStatusTransition(
            "Нельзя завершить заказ: оплата не полная "
            f"(сейчас: {order.payment_status.value}). "
            "Отметьте оплату как «Оплачен»."
        )

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


def update_sales_order_design_approval(
    db: Session,
    order_id: int,
    design_approval_status: DesignApprovalStatus,
) -> SalesOrder:
    order = db.scalar(
        select(SalesOrder).where(SalesOrder.id == order_id).with_for_update()
    )
    if order is None:
        raise SalesOrderNotFoundError("Order not found")
    if order.status in {SalesOrderStatus.COMPLETED, SalesOrderStatus.CANCELLED}:
        raise InvalidSalesOrderStatusTransition(
            f"Cannot change design approval from order status {order.status.value}"
        )
    previous = order.design_approval_status
    if previous == design_approval_status:
        return order
    order.design_approval_status = design_approval_status
    db.add(
        LeadEvent(
            lead_id=order.lead_id,
            order_id=order.id,
            event_type=LeadEventType.ORDER_STATUS_CHANGED,
            message=(
                "Design approval changed: "
                f"{previous.value} → {design_approval_status.value}"
            ),
        )
    )
    db.flush()
    return order


def update_sales_order_payment(
    db: Session,
    order_id: int,
    *,
    payment_status: OrderPaymentStatus | None = None,
    paid_amount: Decimal | None = None,
) -> SalesOrder:
    order = db.scalar(
        select(SalesOrder).where(SalesOrder.id == order_id).with_for_update()
    )
    if order is None:
        raise SalesOrderNotFoundError("Order not found")
    if order.status in {SalesOrderStatus.COMPLETED, SalesOrderStatus.CANCELLED}:
        raise InvalidSalesOrderPaymentUpdate(
            f"Cannot change payment from order status {order.status.value}"
        )
    if payment_status is None and paid_amount is None:
        raise InvalidSalesOrderPaymentUpdate(
            "Provide payment_status and/or paid_amount"
        )

    previous_status = order.payment_status
    previous_paid = order.paid_amount

    if paid_amount is not None:
        # paid_amount is SoT; payment_status is ignored when both are sent
        # (UI may still have a stale select value).
        next_paid = paid_amount
        next_status = derive_payment_status(next_paid, order.amount)
        if (
            payment_status == OrderPaymentStatus.PAID
            and order.amount is None
            and next_paid > 0
        ):
            next_status = OrderPaymentStatus.PAID
    else:
        assert payment_status is not None
        next_status = payment_status
        if payment_status == OrderPaymentStatus.UNPAID:
            next_paid = Decimal("0.00")
        elif payment_status == OrderPaymentStatus.PAID:
            next_paid = (
                order.amount
                if order.amount is not None and order.amount > 0
                else (previous_paid if previous_paid > 0 else Decimal("0.00"))
            )
            if next_paid <= 0:
                raise InvalidSalesOrderPaymentUpdate(
                    "Для статуса «Оплачен» укажите paid_amount или сумму заказа"
                )
        else:
            if previous_paid > 0 and (
                order.amount is None or previous_paid < order.amount
            ):
                next_paid = previous_paid
            elif order.amount is not None and order.amount > 0:
                next_paid = (order.amount / 2).quantize(Decimal("0.01"))
            else:
                next_paid = Decimal("0.01")

    if previous_status == next_status and previous_paid == next_paid:
        return order

    order.payment_status = next_status
    order.paid_amount = next_paid
    db.add(
        LeadEvent(
            lead_id=order.lead_id,
            order_id=order.id,
            event_type=LeadEventType.ORDER_STATUS_CHANGED,
            message=(
                "Payment changed: "
                f"{previous_status.value}/{previous_paid} → "
                f"{next_status.value}/{next_paid}"
            ),
        )
    )
    db.flush()
    return order


def update_sales_order_material_reserve(
    db: Session,
    order_id: int,
    material_reserve_status: MaterialReserveStatus,
) -> SalesOrder:
    order = db.scalar(
        select(SalesOrder).where(SalesOrder.id == order_id).with_for_update()
    )
    if order is None:
        raise SalesOrderNotFoundError("Order not found")
    if order.status in {SalesOrderStatus.COMPLETED, SalesOrderStatus.CANCELLED}:
        raise InvalidSalesOrderStatusTransition(
            f"Cannot change material reserve from order status {order.status.value}"
        )
    previous = order.material_reserve_status
    if previous == material_reserve_status:
        return order
    order.material_reserve_status = material_reserve_status
    db.add(
        LeadEvent(
            lead_id=order.lead_id,
            order_id=order.id,
            event_type=LeadEventType.ORDER_STATUS_CHANGED,
            message=(
                "Material reserve changed: "
                f"{previous.value} → {material_reserve_status.value}"
            ),
        )
    )
    db.flush()
    return order
