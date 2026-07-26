from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class StockBalanceRead(BaseModel):
    """Projected balance per nomenclature from the stock register (`4.6.5` / `4.10.6`)."""

    model_config = ConfigDict(from_attributes=True)

    nomenclature_id: int = Field(ge=1)
    quantity: Decimal = Field(max_digits=14, decimal_places=3)
