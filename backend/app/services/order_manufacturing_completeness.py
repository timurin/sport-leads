"""Order manufacturing completeness from technical cards (ADR-016 §4 / Stage 9.5).

An order is production-complete when every eligible line has a technical card in
``completed`` status. Cancelled cards and missing cards on eligible lines block
completeness. Non-eligible lines are ignored. Orders with zero eligible lines
are vacuously complete (no TC gate).
"""

from __future__ import annotations

from dataclasses import dataclass, field

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.sales import SalesOrder, SalesOrderItem
from app.models.technical_card import TechnicalCard, TechnicalCardStatus
from app.services.technical_cards import is_eligible_order_item


class OrderManufacturingNotFoundError(RuntimeError):
    pass


@dataclass
class OrderManufacturingCompleteness:
    sales_order_id: int
    eligible_count: int = 0
    completed_count: int = 0
    missing_count: int = 0
    open_count: int = 0
    cancelled_count: int = 0
    manufacturing_complete: bool = True
    blocking_item_ids: list[int] = field(default_factory=list)

    @property
    def completeness_percent(self) -> int:
        if self.eligible_count == 0:
            return 100
        return int(round((self.completed_count / self.eligible_count) * 100))


def compute_order_manufacturing_completeness(
    db: Session, order_id: int
) -> OrderManufacturingCompleteness:
    order = db.scalar(
        select(SalesOrder)
        .options(selectinload(SalesOrder.items))
        .where(SalesOrder.id == order_id)
    )
    if order is None:
        raise OrderManufacturingNotFoundError("Order not found")

    cards = list(
        db.scalars(
            select(TechnicalCard).where(TechnicalCard.sales_order_id == order_id)
        ).all()
    )
    by_item = {card.sales_order_item_id: card for card in cards}

    result = OrderManufacturingCompleteness(sales_order_id=order_id)
    items: list[SalesOrderItem] = sorted(order.items, key=lambda item: (item.position, item.id))

    for item in items:
        eligible, _ = is_eligible_order_item(db, item)
        if not eligible:
            continue

        result.eligible_count += 1
        card = by_item.get(item.id)
        if card is None:
            result.missing_count += 1
            result.blocking_item_ids.append(item.id)
            continue
        if card.status == TechnicalCardStatus.COMPLETED:
            result.completed_count += 1
        elif card.status == TechnicalCardStatus.CANCELLED:
            result.cancelled_count += 1
            result.missing_count += 1
            result.blocking_item_ids.append(item.id)
        else:
            result.open_count += 1
            result.blocking_item_ids.append(item.id)

    result.manufacturing_complete = (
        result.eligible_count == 0 or result.completed_count == result.eligible_count
    )
    return result


def require_manufacturing_complete_for_status(
    db: Session, order_id: int, *, target_label: str = "production-complete"
) -> OrderManufacturingCompleteness:
    """Raise if order cannot be treated as production-complete yet."""
    completeness = compute_order_manufacturing_completeness(db, order_id)
    if completeness.manufacturing_complete:
        return completeness
    raise OrderManufacturingIncompleteError(
        f"Cannot mark order as {target_label}: technical cards incomplete "
        f"({completeness.completed_count}/{completeness.eligible_count} completed; "
        f"blocking items {completeness.blocking_item_ids})"
    )


class OrderManufacturingIncompleteError(RuntimeError):
    pass
