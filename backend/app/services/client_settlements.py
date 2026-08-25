from __future__ import annotations

from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.sales import Client, SalesOrder, SalesOrderStatus
from app.schemas.client_settlements import ClientSettlementsSummary

ZERO = Decimal("0.00")
CENTS = Decimal("0.01")
_OPEN_EXCLUDED = frozenset({SalesOrderStatus.CANCELLED, SalesOrderStatus.COMPLETED})


class ClientSettlementsNotFoundError(RuntimeError):
    pass


def _quantize(value: Decimal) -> Decimal:
    return value.quantize(CENTS)


def _as_decimal(value: object) -> Decimal:
    if isinstance(value, Decimal):
        return value
    return Decimal(str(value))


def get_client_settlements_summary(
    db: Session,
    client_id: int,
) -> ClientSettlementsSummary:
    client = db.get(Client, client_id)
    if client is None:
        raise ClientSettlementsNotFoundError("Client not found")

    orders = list(
        db.scalars(
            select(SalesOrder).where(
                SalesOrder.client_id == client_id,
                SalesOrder.status != SalesOrderStatus.CANCELLED,
            )
        ).all()
    )

    open_order_count = 0
    open_order_amount = ZERO
    receivable = ZERO
    advance = ZERO
    paid_total = ZERO
    orders_without_amount_count = 0

    for order in orders:
        paid = _as_decimal(order.paid_amount)
        paid_total += paid
        status = order.status
        if status not in _OPEN_EXCLUDED:
            open_order_count += 1
            if order.amount is not None:
                open_order_amount += _as_decimal(order.amount)
        if order.amount is None:
            orders_without_amount_count += 1
            continue
        amount = _as_decimal(order.amount)
        due = amount - paid
        if due > ZERO:
            receivable += due
        elif due < ZERO:
            advance += -due

    return ClientSettlementsSummary(
        open_order_count=open_order_count,
        open_order_amount=_quantize(open_order_amount),
        receivable=_quantize(receivable),
        advance=_quantize(advance),
        paid_total=_quantize(paid_total),
        orders_without_amount_count=orders_without_amount_count,
    )
