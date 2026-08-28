"""Purchase order schemas (Stage 13.1.2 / ADR-034)."""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class PurchaseOrderLineCreate(BaseModel):
    nomenclature_id: int = Field(..., ge=1)
    quantity: Decimal
    unit_price: Decimal | None = None
    comment: str | None = Field(default=None, max_length=255)

    @field_validator("quantity")
    @classmethod
    def quantity_positive(cls, value: Decimal) -> Decimal:
        if value <= 0:
            raise ValueError("quantity must be > 0")
        return value

    @field_validator("unit_price")
    @classmethod
    def unit_price_positive(cls, value: Decimal | None) -> Decimal | None:
        if value is not None and value <= 0:
            raise ValueError("unit_price must be > 0")
        return value


class PurchaseOrderLineUpdate(BaseModel):
    quantity: Decimal | None = None
    unit_price: Decimal | None = None
    comment: str | None = Field(default=None, max_length=255)

    @field_validator("quantity")
    @classmethod
    def quantity_positive(cls, value: Decimal | None) -> Decimal | None:
        if value is not None and value <= 0:
            raise ValueError("quantity must be > 0")
        return value

    @field_validator("unit_price")
    @classmethod
    def unit_price_positive(cls, value: Decimal | None) -> Decimal | None:
        if value is not None and value <= 0:
            raise ValueError("unit_price must be > 0")
        return value


class PurchaseOrderCreate(BaseModel):
    supplier_id: int = Field(..., ge=1)
    expected_date: date | None = None
    warehouse_id: int | None = Field(default=None, ge=1)
    notes: str | None = None
    lines: list[PurchaseOrderLineCreate] = Field(default_factory=list)


class PurchaseOrderUpdate(BaseModel):
    expected_date: date | None = None
    warehouse_id: int | None = Field(default=None, ge=1)
    notes: str | None = None
    clear_expected_date: bool = False
    clear_warehouse: bool = False


class PurchaseOrderLineRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    purchase_order_id: int
    nomenclature_id: int
    nomenclature_name: str
    quantity: Decimal
    unit_price: Decimal
    line_amount: Decimal
    comment: str | None
    created_at: datetime
    updated_at: datetime


class PurchaseOrderListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    number: str
    supplier_id: int
    supplier_name: str
    status: str
    expected_date: date | None
    warehouse_id: int | None
    total_amount: Decimal
    currency: str
    created_at: datetime
    updated_at: datetime


class PurchaseOrderDetailRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    number: str
    supplier_id: int
    supplier_name: str
    status: str
    expected_date: date | None
    warehouse_id: int | None
    warehouse_name: str | None
    notes: str | None
    currency: str
    total_amount: Decimal
    ordered_at: datetime | None
    cancelled_at: datetime | None
    created_at: datetime
    updated_at: datetime
    lines: list[PurchaseOrderLineRead]
