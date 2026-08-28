"""Tech-card QR scan DTOs (ADR-030 / Stage 25)."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class TechCardScanMaterialFact(BaseModel):
    composition_line_id: int = Field(ge=1)
    fact_qty: Decimal = Field(ge=0, max_digits=14, decimal_places=3)


class TechCardScanCommandRequest(BaseModel):
    production_stage_id: int = Field(ge=1)
    unit_line_ids: list[int] = Field(min_length=1)
    performer_name: str | None = Field(default=None, max_length=255)
    work_done: str | None = None
    duration_seconds: int | None = Field(default=None, ge=0)
    notes: str | None = None
    scrap_qty: Decimal | None = Field(default=None, ge=0, max_digits=14, decimal_places=3)
    rework_qty: Decimal | None = Field(default=None, ge=0, max_digits=14, decimal_places=3)
    work_center_id: int | None = Field(default=None, ge=1)
    material_facts: list[TechCardScanMaterialFact] = Field(default_factory=list)

    @field_validator("performer_name", "work_done", "notes", mode="before")
    @classmethod
    def strip_text(cls, value: object) -> object:
        if isinstance(value, str):
            stripped = value.strip()
            return stripped or None
        return value

    @field_validator("unit_line_ids")
    @classmethod
    def unique_unit_ids(cls, value: list[int]) -> list[int]:
        if len(set(value)) != len(value):
            raise ValueError("unit_line_ids must be unique")
        return value


class TechCardScanUnitRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    unit_index: int
    size: str | None = None
    personalization: str | None = None
    print_number: str | None = None
    production_stage_id: int | None = None
    stage_label: str | None = None
    last_transfer_kind: str | None = None
    fg_receipt_posted: bool = False
    fg_issue_posted: bool = False


class TechCardScanMaterialRead(BaseModel):
    composition_line_id: int
    snapshot_name: str
    planned_qty: Decimal | None = None
    fact_qty: Decimal | None = None
    unit: str | None = None
    production_stage_id: int | None = None


class TechCardScanStageRead(BaseModel):
    production_stage_id: int
    stage_order: int
    stage_label: str
    stage_code: str | None = None
    relation: str


class TechCardScanRead(BaseModel):
    technical_card_id: int
    number: str
    display_number: str | None = None
    status: str
    wip_status: str
    wip_status_label: str
    quantity: Decimal
    nomenclature_name: str | None = None
    current_stage_label: str | None = None
    scan_url: str
    restricted_sewing_only: bool = False
    units: list[TechCardScanUnitRead] = Field(default_factory=list)
    allowed_stages: list[TechCardScanStageRead] = Field(default_factory=list)
    material_lines: list[TechCardScanMaterialRead] = Field(default_factory=list)
    updated_at: datetime
