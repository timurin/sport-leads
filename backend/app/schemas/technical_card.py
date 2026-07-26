"""Pydantic schemas for technical cards (ADR-016 / Stage 9.1.2–9.2.1)."""

from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.technical_card import (
    TechnicalCardCompositionLineKind,
    TechnicalCardStageResultStatus,
    TechnicalCardStatus,
    TechOperationVolumeUnit,
)


class TechnicalCardCompositionLineWrite(BaseModel):
    sequence: int = Field(ge=1)
    line_kind: TechnicalCardCompositionLineKind = TechnicalCardCompositionLineKind.MATERIAL
    nomenclature_id: int | None = None
    snapshot_name: str = Field(min_length=1, max_length=255)
    quantity: Decimal | None = Field(default=None, ge=0, max_digits=14, decimal_places=3)
    unit: str | None = Field(default=None, max_length=30)
    notes: str | None = None

    @field_validator("snapshot_name", "unit", mode="before")
    @classmethod
    def strip_optional_text(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value


class TechnicalCardCompositionLineRead(TechnicalCardCompositionLineWrite):
    model_config = ConfigDict(from_attributes=True)

    id: int
    technical_card_id: int
    created_at: datetime
    updated_at: datetime


class TechnicalCardUnitLineWrite(BaseModel):
    unit_index: int = Field(ge=1)
    size: str | None = Field(default=None, max_length=100)
    personalization: str | None = Field(default=None, max_length=500)
    print_number: str | None = Field(default=None, max_length=50)
    color: str | None = Field(default=None, max_length=100)
    notes: str | None = None

    @field_validator("size", "personalization", "print_number", "color", mode="before")
    @classmethod
    def strip_optional_text(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value


class TechnicalCardUnitLineRead(TechnicalCardUnitLineWrite):
    model_config = ConfigDict(from_attributes=True)

    id: int
    technical_card_id: int
    created_at: datetime
    updated_at: datetime


class TechnicalCardOperationLineWrite(BaseModel):
    sequence: int = Field(ge=1)
    tech_operation_id: int | None = Field(
        default=None,
        description="Soft catalog id until Stage 8.1.3 TechOperation table exists",
    )
    operation_name: str = Field(min_length=1, max_length=255)
    volume_unit: TechOperationVolumeUnit
    volume: Decimal = Field(default=Decimal("0"), ge=0, max_digits=14, decimal_places=3)
    stage_order: int | None = Field(default=None, ge=1)
    stage_label: str | None = Field(default=None, max_length=255)

    @field_validator("operation_name", "stage_label", mode="before")
    @classmethod
    def strip_text(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value


class TechnicalCardOperationLineRead(TechnicalCardOperationLineWrite):
    model_config = ConfigDict(from_attributes=True)

    id: int
    technical_card_id: int
    created_at: datetime
    updated_at: datetime


class TechnicalCardStageResultWrite(BaseModel):
    stage_order: int = Field(ge=1)
    stage_label: str = Field(min_length=1, max_length=255)
    status: TechnicalCardStageResultStatus = TechnicalCardStageResultStatus.PENDING
    performer_name: str | None = Field(default=None, max_length=255)
    started_at: datetime | None = None
    completed_at: datetime | None = None
    scrap_qty: Decimal | None = Field(default=None, ge=0, max_digits=14, decimal_places=3)
    rework_qty: Decimal | None = Field(default=None, ge=0, max_digits=14, decimal_places=3)
    notes: str | None = None

    @field_validator("stage_label", "performer_name", mode="before")
    @classmethod
    def strip_text(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value


class TechnicalCardStageResultRead(TechnicalCardStageResultWrite):
    model_config = ConfigDict(from_attributes=True)

    id: int
    technical_card_id: int
    created_at: datetime
    updated_at: datetime


class TechnicalCardStageStartRequest(BaseModel):
    performer_name: str | None = Field(default=None, max_length=255)

    @field_validator("performer_name", mode="before")
    @classmethod
    def strip_performer(cls, value: object) -> object:
        if isinstance(value, str):
            stripped = value.strip()
            return stripped or None
        return value


class TechnicalCardStageCompleteRequest(BaseModel):
    performer_name: str | None = Field(default=None, max_length=255)
    scrap_qty: Decimal | None = Field(default=None, ge=0, max_digits=14, decimal_places=3)
    rework_qty: Decimal | None = Field(default=None, ge=0, max_digits=14, decimal_places=3)
    notes: str | None = None

    @field_validator("performer_name", "notes", mode="before")
    @classmethod
    def strip_text(cls, value: object) -> object:
        if isinstance(value, str):
            stripped = value.strip()
            return stripped or None
        return value


class TechnicalCardWrite(BaseModel):
    sales_order_id: int
    sales_order_item_id: int
    number: str = Field(min_length=1, max_length=80)
    card_seq: int = Field(ge=1)
    status: TechnicalCardStatus = TechnicalCardStatus.DRAFT
    quantity: Decimal = Field(gt=0, max_digits=14, decimal_places=3)

    nomenclature_id: int | None = None
    nomenclature_name: str | None = Field(default=None, max_length=255)
    nomenclature_type: str | None = Field(default=None, max_length=30)

    product_model_id: int | None = None
    product_model_article: str | None = Field(default=None, max_length=100)
    product_model_name: str | None = Field(default=None, max_length=255)
    product_model_size_type: str | None = Field(default=None, max_length=20)

    assembly_variant_id: int | None = None
    assembly_variant_name: str | None = Field(default=None, max_length=255)
    assembly_variant_total_cost: Decimal | None = Field(
        default=None, ge=0, max_digits=14, decimal_places=2
    )

    specification_version_id: int | None = None
    specification_version_label: str | None = Field(default=None, max_length=255)
    routing_template_id: int | None = None
    routing_template_name: str | None = Field(default=None, max_length=255)

    current_stage_order: int | None = Field(default=None, ge=1)
    current_stage_label: str | None = Field(default=None, max_length=255)

    design_mockup_url: str | None = Field(default=None, max_length=1000)
    notes: str | None = None

    composition_lines: list[TechnicalCardCompositionLineWrite] = Field(default_factory=list)
    unit_lines: list[TechnicalCardUnitLineWrite] = Field(default_factory=list)
    operation_lines: list[TechnicalCardOperationLineWrite] = Field(default_factory=list)
    stage_results: list[TechnicalCardStageResultWrite] = Field(default_factory=list)

    @field_validator(
        "number",
        "nomenclature_name",
        "nomenclature_type",
        "product_model_article",
        "product_model_name",
        "product_model_size_type",
        "assembly_variant_name",
        "specification_version_label",
        "routing_template_name",
        "current_stage_label",
        mode="before",
    )
    @classmethod
    def strip_text(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value


class TechnicalCardRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    sales_order_id: int
    sales_order_item_id: int
    number: str
    card_seq: int
    status: TechnicalCardStatus
    quantity: Decimal

    nomenclature_id: int | None = None
    nomenclature_name: str | None = None
    nomenclature_type: str | None = None

    product_model_id: int | None = None
    product_model_article: str | None = None
    product_model_name: str | None = None
    product_model_size_type: str | None = None

    assembly_variant_id: int | None = None
    assembly_variant_name: str | None = None
    assembly_variant_total_cost: Decimal | None = None

    specification_version_id: int | None = None
    specification_version_label: str | None = None
    routing_template_id: int | None = None
    routing_template_name: str | None = None

    current_stage_order: int | None = None
    current_stage_label: str | None = None

    design_mockup_url: str | None = None
    notes: str | None = None

    composition_lines: list[TechnicalCardCompositionLineRead] = Field(default_factory=list)
    unit_lines: list[TechnicalCardUnitLineRead] = Field(default_factory=list)
    operation_lines: list[TechnicalCardOperationLineRead] = Field(default_factory=list)
    stage_results: list[TechnicalCardStageResultRead] = Field(default_factory=list)

    created_at: datetime
    updated_at: datetime


class TechnicalCardListRead(TechnicalCardRead):
    """Production list row with order number (Stage 9.4.2)."""

    order_number: str | None = None


class TechnicalCardGenerateRequest(BaseModel):
    """Optional subset of order lines; default = all eligible without an active card."""

    sales_order_item_ids: list[int] | None = None


class TechnicalCardPreviewLine(BaseModel):
    sales_order_item_id: int
    position: int
    snapshot_name: str
    quantity: Decimal
    eligible: bool
    skip_reason: str | None = None
    existing_card_id: int | None = None
    existing_status: TechnicalCardStatus | None = None
    would_create: bool = False
    would_revive: bool = False
    planned_unit_line_count: int | None = None


class TechnicalCardPreviewRead(BaseModel):
    sales_order_id: int
    order_number: str
    lines: list[TechnicalCardPreviewLine]
    create_count: int
    revive_count: int


class OrderManufacturingCompletenessRead(BaseModel):
    """ADR-016 §4 / Stage 9.5 — production-complete flag for the sales order."""

    sales_order_id: int
    eligible_count: int
    completed_count: int
    missing_count: int
    open_count: int
    cancelled_count: int
    completeness_percent: int
    manufacturing_complete: bool
    blocking_item_ids: list[int] = Field(default_factory=list)


class TechnicalCardSkippedLine(BaseModel):
    sales_order_item_id: int
    reason: str
    existing_card_id: int | None = None


class TechnicalCardGenerateRead(BaseModel):
    sales_order_id: int
    created: list[TechnicalCardRead] = Field(default_factory=list)
    revived: list[TechnicalCardRead] = Field(default_factory=list)
    skipped: list[TechnicalCardSkippedLine] = Field(default_factory=list)


class TechnicalCardCompositionReplace(BaseModel):
    lines: list[TechnicalCardCompositionLineWrite] = Field(default_factory=list)


class TechnicalCardApplySpecification(BaseModel):
    """Stamp approved Spec version on the card and replace planned composition.

    Until Stage 7 catalog exists, callers supply the approved version snapshot
    lines explicitly (no demo / no invented materials).
    """

    specification_version_id: int = Field(ge=1)
    specification_version_label: str = Field(min_length=1, max_length=255)
    lines: list[TechnicalCardCompositionLineWrite] = Field(default_factory=list)

    @field_validator("specification_version_label", mode="before")
    @classmethod
    def strip_label(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value


# --- Unit lines (Stage 9.3.2) ---
# MVP field set: unit_index, size, personalization, print_number, color, notes.


class TechnicalCardUnitLineUpdate(BaseModel):
    """Partial per-row edit; unit_index is immutable via this payload."""

    size: str | None = Field(default=None, max_length=100)
    personalization: str | None = Field(default=None, max_length=500)
    print_number: str | None = Field(default=None, max_length=50)
    color: str | None = Field(default=None, max_length=100)
    notes: str | None = None

    @field_validator("size", "personalization", "print_number", "color", "notes", mode="before")
    @classmethod
    def strip_optional_text(cls, value: object) -> object:
        if isinstance(value, str):
            stripped = value.strip()
            return stripped if stripped else None
        return value


class TechnicalCardUnitLineBulkItem(TechnicalCardUnitLineUpdate):
    id: int | None = None
    unit_index: int | None = Field(default=None, ge=1)


class TechnicalCardUnitLinesBulkUpdate(BaseModel):
    lines: list[TechnicalCardUnitLineBulkItem] = Field(min_length=1)


class TechnicalCardUnitLinesReplace(BaseModel):
    """Full replace; count must equal card quantity (use sync-unit-lines to change N)."""

    lines: list[TechnicalCardUnitLineWrite]


class TechnicalCardUnitLinesImport(BaseModel):
    """JSON import hook: rows keyed by unit_index (1..N). Missing indices keep current values."""

    lines: list[TechnicalCardUnitLineBulkItem] = Field(min_length=1)


# --- Operation volume lines (Stage 9.3.3) ---


class TechnicalCardOperationLinesReplace(BaseModel):
    lines: list[TechnicalCardOperationLineWrite] = Field(default_factory=list)


class TechnicalCardOperationLineVolumeUpdate(BaseModel):
    """Manager volume edit; stage binding stays stable after generate."""

    volume: Decimal = Field(ge=0, max_digits=14, decimal_places=3)
    operation_name: str | None = Field(default=None, min_length=1, max_length=255)

    @field_validator("operation_name", mode="before")
    @classmethod
    def strip_name(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value


class TechnicalCardOperationLinesPrefillRead(BaseModel):
    """Soft prefill result: empty until TechOperation catalog `8.1.3` ships."""

    card: TechnicalCardRead
    prefilled: bool
    catalog_available: bool
    message: str
