"""Specification document DTOs (ADR-031 / Stage 7.1.2.3)."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class SpecificationCreate(BaseModel):
    production_batch_id: int = Field(gt=0)

    @field_validator("production_batch_id")
    @classmethod
    def positive_batch(cls, value: int) -> int:
        if value <= 0:
            raise ValueError("production_batch_id must be positive")
        return value


class SpecificationProductLineRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    sequence: int
    technical_card_id: int
    sales_order_item_id: int | None = None
    nomenclature_id: int | None = None
    nomenclature_name: str | None = None
    nomenclature_type: str | None = None
    product_model_id: int | None = None
    product_model_article: str | None = None
    product_model_name: str | None = None
    assembly_variant_id: int | None = None
    assembly_variant_name: str | None = None
    quantity: Decimal
    created_at: datetime
    updated_at: datetime


class SpecificationMaterialLineRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    sequence: int
    nomenclature_id: int | None = None
    snapshot_name: str
    unit: str | None = None
    production_stage_id: int | None = None
    planned_qty: Decimal | None = None
    fact_qty: Decimal | None = None
    created_at: datetime
    updated_at: datetime


class SpecificationOperationLineRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    sequence: int
    source_kind: str
    technical_card_id: int | None = None
    tech_operation_id: int | None = None
    sewing_operation_id: int | None = None
    operation_name: str
    volume_unit: str
    planned_volume: Decimal
    fact_volume: Decimal | None = None
    duration_seconds: int | None = None
    performer_name: str | None = None
    production_stage_id: int | None = None
    stage_label: str | None = None
    created_at: datetime
    updated_at: datetime


class SpecificationVersionSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    version_no: int
    status: str
    approved_at: datetime | None = None
    cancelled_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class SpecificationVersionRead(SpecificationVersionSummary):
    product_lines: list[SpecificationProductLineRead] = Field(default_factory=list)
    material_lines: list[SpecificationMaterialLineRead] = Field(default_factory=list)
    operation_lines: list[SpecificationOperationLineRead] = Field(default_factory=list)


class SpecificationListItem(BaseModel):
    id: int
    number: str
    production_batch_id: int
    production_batch_number: str | None = None
    sales_order_id: int | None = None
    sales_order_number: str | None = None
    production_order_id: int
    production_order_number: str | None = None
    current_version_no: int | None = None
    current_version_status: str | None = None
    created_at: datetime
    updated_at: datetime


class SpecificationRead(SpecificationListItem):
    notes: str | None = None
    versions: list[SpecificationVersionSummary] = Field(default_factory=list)
    current_version: SpecificationVersionRead | None = None
