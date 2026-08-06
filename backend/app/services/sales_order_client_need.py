"""Order client-need fields update + optional lead sync (v1.00 / 20.4.2)."""

from __future__ import annotations

from datetime import date

from sqlalchemy.orm import Session

from app.models.sales import Lead, SalesOrder
from app.schemas.sales import SalesOrderClientNeedUpdate
from app.services.sales_order_status import SalesOrderNotFoundError


class SalesOrderClientNeedError(RuntimeError):
    pass


def update_sales_order_client_need(
    db: Session,
    order_id: int,
    payload: SalesOrderClientNeedUpdate,
) -> SalesOrder:
    order = db.get(SalesOrder, order_id)
    if order is None:
        raise SalesOrderNotFoundError("Заказ не найден")

    data = payload.model_dump(exclude_unset=True)
    sync_to_lead = bool(data.pop("sync_to_lead", True))

    field_map = {
        "description": "description",
        "product_category": "product_category",
        "sport": "sport",
        "quantity": "quantity",
        "desired_date": "desired_date",
        "source": "source",
    }
    changed: dict[str, object] = {}
    for key, attr in field_map.items():
        if key not in data:
            continue
        value = data[key]
        setattr(order, attr, value)
        changed[key] = value

    if sync_to_lead and order.lead_id is not None and changed:
        lead = db.get(Lead, order.lead_id)
        if lead is None:
            raise SalesOrderClientNeedError("Связанный лид не найден")
        if "description" in changed:
            lead.need_description = changed["description"]  # type: ignore[assignment]
        if "product_category" in changed:
            lead.product_category = changed["product_category"]  # type: ignore[assignment]
        if "sport" in changed:
            lead.sport = changed["sport"]  # type: ignore[assignment]
        if "quantity" in changed:
            qty = changed["quantity"]
            lead.estimated_quantity = int(qty) if isinstance(qty, int) else None
        if "desired_date" in changed:
            desired = changed["desired_date"]
            lead.desired_date = desired if isinstance(desired, date) or desired is None else None
        if "source" in changed:
            lead.source = changed["source"]  # type: ignore[assignment]

    db.flush()
    return order
