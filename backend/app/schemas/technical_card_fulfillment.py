from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel


class FulfillmentRead(BaseModel):
    id: int
    number: str
    order_number: str | None
    model: str | None
    quantity: Decimal
    fulfillment_status: Literal["ready_to_ship", "shipped"]
    ready_to_ship_at: datetime
    shipped_at: datetime | None
    shipping_date: date | None
