from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class ClientSettlementsSummary(BaseModel):
    """Read-only projection of SalesOrder payment markers (2.3.3). Not a ledger."""

    model_config = ConfigDict(extra="forbid")

    currency_code: Literal["RUB"] = "RUB"
    open_order_count: int = 0
    open_order_amount: Decimal = Field(
        default=Decimal("0.00"), ge=0, max_digits=14, decimal_places=2
    )
    receivable: Decimal = Field(
        default=Decimal("0.00"), ge=0, max_digits=14, decimal_places=2
    )
    advance: Decimal = Field(
        default=Decimal("0.00"), ge=0, max_digits=14, decimal_places=2
    )
    paid_total: Decimal = Field(
        default=Decimal("0.00"), ge=0, max_digits=14, decimal_places=2
    )
    orders_without_amount_count: int = 0
    source: Literal["sales_order_payment_markers"] = "sales_order_payment_markers"
    ledger_stage: Literal["14.2"] = "14.2"
