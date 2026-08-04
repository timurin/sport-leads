from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class StockBalanceRead(BaseModel):
    """Projected balance from the stock register (ADR-012 / ADR-019 / `12.1.2`).

    Dimension: `(warehouse_id, nomenclature_id)`. When `warehouse_id` is null the
    quantity is aggregated across warehouses (list column on `/warehouse/stock`).
    Bins / lots are out of MVP — no fields here.
    """

    model_config = ConfigDict(from_attributes=True)

    nomenclature_id: int = Field(ge=1)
    quantity: Decimal = Field(max_digits=14, decimal_places=3)
    warehouse_id: int | None = Field(
        default=None,
        ge=1,
        description="Warehouse scope; null = aggregated across warehouses",
    )


class StockDocumentLineCreate(BaseModel):
    """Absolute quantity; service applies sign from document type."""

    nomenclature_id: int = Field(ge=1)
    quantity: Decimal = Field(gt=0, max_digits=14, decimal_places=3)


class StockDocumentCreate(BaseModel):
    doc_type: str = Field(pattern="^(receipt|issue|fg_receipt|fg_issue)$")
    warehouse_id: int = Field(ge=1)
    lines: list[StockDocumentLineCreate] = Field(min_length=1)
    notes: str | None = Field(default=None, max_length=4000)
    technical_card_id: int | None = Field(default=None, ge=1)
    sales_order_id: int | None = Field(default=None, ge=1)
    post: bool = Field(
        default=True,
        description="When true, post immediately (MVP default for register write)",
    )

    @field_validator("notes", mode="before")
    @classmethod
    def strip_notes(cls, value: object) -> object:
        if isinstance(value, str):
            stripped = value.strip()
            return stripped or None
        return value


class StockLedgerLineRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    line_no: int
    warehouse_id: int
    nomenclature_id: int
    quantity: Decimal
    posted_at: datetime | None
    technical_card_id: int | None
    sales_order_id: int | None


class StockDocumentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    number: str
    doc_type: str
    status: str
    warehouse_id: int
    posted_at: datetime | None
    technical_card_id: int | None
    sales_order_id: int | None
    notes: str | None
    created_at: datetime
    updated_at: datetime
    ledger_lines: list[StockLedgerLineRead] = Field(default_factory=list)
