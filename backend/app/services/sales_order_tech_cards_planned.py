"""PATCH SalesOrder.tech_cards_planned_count (Stage 28.1)."""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.sales import SalesOrder
from app.services.sales_order_status import SalesOrderNotFoundError


class SalesOrderTechCardsPlannedCountError(RuntimeError):
    pass


def update_sales_order_tech_cards_planned_count(
    db: Session, order_id: int, planned_count: int | None
) -> SalesOrder:
    order = db.get(SalesOrder, order_id)
    if order is None:
        raise SalesOrderNotFoundError("Order not found")
    if planned_count is not None and planned_count < 1:
        raise SalesOrderTechCardsPlannedCountError(
            "tech_cards_planned_count must be null or ≥ 1"
        )
    order.tech_cards_planned_count = planned_count
    db.flush()
    return order
