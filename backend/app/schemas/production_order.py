"""Pydantic schemas for ProductionOrder / ProductionBatch (ADR-018 / 11.1.1.3)."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ProductionOrderCreate(BaseModel):
    sales_order_id: int = Field(gt=0)
    notes: str | None = Field(default=None, max_length=4000)

    @field_validator("notes", mode="before")
    @classmethod
    def strip_notes(cls, value: object) -> object:
        if isinstance(value, str):
            trimmed = value.strip()
            return trimmed or None
        return value


class ProductionBatchCreate(BaseModel):
    notes: str | None = Field(default=None, max_length=4000)
    technical_card_ids: list[int] = Field(default_factory=list)

    @field_validator("notes", mode="before")
    @classmethod
    def strip_notes(cls, value: object) -> object:
        if isinstance(value, str):
            trimmed = value.strip()
            return trimmed or None
        return value

    @field_validator("technical_card_ids")
    @classmethod
    def unique_positive_ids(cls, value: list[int]) -> list[int]:
        cleaned: list[int] = []
        seen: set[int] = set()
        for item in value:
            if not isinstance(item, int) or item <= 0:
                raise ValueError("technical_card_ids must be positive integers")
            if item in seen:
                continue
            seen.add(item)
            cleaned.append(item)
        return cleaned


class ProductionBatchAttachCardRequest(BaseModel):
    technical_card_id: int = Field(gt=0)


class ProductionBatchCardLinkRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    production_batch_id: int
    technical_card_id: int
    technical_card_number: str | None = None
    created_at: datetime


class ProductionBatchRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    production_order_id: int
    number: str
    batch_seq: int
    status: str
    notes: str | None = None
    card_links: list[ProductionBatchCardLinkRead] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime


class ProductionOrderListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    sales_order_id: int
    sales_order_number: str | None = None
    number: str
    order_seq: int
    status: str
    notes: str | None = None
    batch_count: int = 0
    created_at: datetime
    updated_at: datetime


class ProductionOrderRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    sales_order_id: int
    sales_order_number: str | None = None
    number: str
    order_seq: int
    status: str
    notes: str | None = None
    batches: list[ProductionBatchRead] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime


class ProductionFactRollupMaterialLine(BaseModel):
    nomenclature_id: int | None = None
    snapshot_name: str
    unit: str | None = None
    planned_qty: Decimal | None = None
    fact_qty: Decimal | None = None


class ProductionFactRollupOperationLine(BaseModel):
    operation_name: str
    volume_unit: str | None = None
    stage_order: int | None = None
    stage_label: str | None = None
    volume: Decimal


class ProductionFactRollupPerformer(BaseModel):
    performer_name: str
    stage_labels: list[str] = Field(default_factory=list)


class ProductionFactRollupRead(BaseModel):
    """Read-only aggregate fact over linked technical cards (ADR-018 §8 / 11.2.1.2)."""

    scope: str  # "batch" | "order"
    production_order_id: int | None = None
    production_batch_id: int | None = None
    technical_card_count: int = 0
    technical_card_ids: list[int] = Field(default_factory=list)
    quantity_total: Decimal = Decimal("0")
    cards_completed: int = 0
    cards_in_progress: int = 0
    cards_other: int = 0
    duration_seconds_total: int = 0
    scrap_qty_total: Decimal = Decimal("0")
    rework_qty_total: Decimal = Decimal("0")
    performers: list[ProductionFactRollupPerformer] = Field(default_factory=list)
    materials: list[ProductionFactRollupMaterialLine] = Field(default_factory=list)
    operations: list[ProductionFactRollupOperationLine] = Field(default_factory=list)
