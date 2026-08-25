"""Sewing cabinet / work ledger API schemas (ADR-029 / Stage 24)."""

from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class SewingWorkTakeRequest(BaseModel):
    technical_card_id: int = Field(ge=1)
    kind: Literal["piece", "operation"]
    qty: Decimal = Field(gt=0, max_digits=14, decimal_places=3)
    operation_line_id: int | None = Field(default=None, ge=1)

    @model_validator(mode="after")
    def kind_matches_line(self) -> "SewingWorkTakeRequest":
        if self.kind == "operation" and self.operation_line_id is None:
            raise ValueError("Для операции укажите operation_line_id")
        if self.kind == "piece" and self.operation_line_id is not None:
            raise ValueError("Для штук operation_line_id не задаётся")
        return self


class SewingCabinetProfileRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    login: str
    display_name: str
    photo_url: str | None = None


class SewingWorkEntryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    platform_user_id: int
    technical_card_id: int
    technical_card_number: str
    kind: Literal["piece", "operation"]
    operation_line_id: int | None
    qty: Decimal
    status: Literal["reserved", "completed", "released"]
    unit_price: Decimal
    price_label: str
    amount: Decimal
    taken_at: datetime
    completed_at: datetime | None
    released_at: datetime | None


class SewingQueueOperationRead(BaseModel):
    operation_line_id: int
    operation_name: str
    volume: Decimal
    remaining: Decimal
    unit_price: Decimal | None


class SewingQueueCardRead(BaseModel):
    technical_card_id: int
    number: str
    nomenclature_name: str | None
    product_model_name: str | None
    assembly_variant_name: str | None
    piece_cap: int
    piece_remaining: Decimal
    piece_unit_price: Decimal | None
    operations: list[SewingQueueOperationRead]


class SewingCabinetPeriodRead(BaseModel):
    preset: Literal["day", "week", "month", "custom"]
    date_from: datetime
    date_to: datetime


class SewingCabinetRead(BaseModel):
    profile: SewingCabinetProfileRead
    period: SewingCabinetPeriodRead
    earnings_completed: Decimal
    reserved: list[SewingWorkEntryRead]
    history: list[SewingWorkEntryRead]
    queue: list[SewingQueueCardRead] | None
    can_write: bool
    can_manage: bool


class SewingSewerListItem(BaseModel):
    id: int
    login: str
    display_name: str
    photo_url: str | None = None
    reserved_count: int
    earnings_completed: Decimal
