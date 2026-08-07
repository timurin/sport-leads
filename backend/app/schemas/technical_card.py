"""Pydantic schemas for technical cards (ADR-016 / Stage 9.1.2–9.2.1)."""

from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.technical_card import (
    TechnicalCardCompositionLineKind,
    TechnicalCardOperationLineSourceKind,
    TechnicalCardStageResultStatus,
    TechnicalCardStatus,
    TechOperationVolumeUnit,
)

UNIT_LINE_SIZE_TYPES = frozenset({"male", "female"})


def _normalize_unit_line_size_type(value: object) -> object:
    """Active unit-line size_type is male/female (9.3.2.5); legacy aliases accepted on write."""
    if value is None:
        return None
    if not isinstance(value, str):
        return value
    stripped = value.strip().lower()
    if not stripped:
        return None
    aliases = {
        "male": "male",
        "men": "male",
        "мужской": "male",
        "female": "female",
        "women": "female",
        "женский": "female",
    }
    if stripped in aliases:
        return aliases[stripped]
    raise ValueError("size_type must be male or female")


def map_product_model_size_type_to_unit_line(value: str | None) -> str | None:
    """ProductModel uses men/women/kids; unit lines use male/female only."""
    if value is None:
        return None
    normalized = value.strip().lower()
    if normalized in {"men", "male"}:
        return "male"
    if normalized in {"women", "female"}:
        return "female"
    return None


class TechnicalCardCompositionLineWrite(BaseModel):
    sequence: int = Field(ge=1)
    line_kind: TechnicalCardCompositionLineKind = TechnicalCardCompositionLineKind.MATERIAL
    nomenclature_id: int | None = None
    snapshot_name: str = Field(min_length=1, max_length=255)
    planned_qty: Decimal | None = Field(default=None, ge=0, max_digits=14, decimal_places=3)
    production_stage_id: int | None = None
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
    fact_qty: Decimal | None = None
    created_at: datetime
    updated_at: datetime


class TechnicalCardCompositionFactQtyUpdate(BaseModel):
    """Shop-path write for MATERIAL fact_qty (`9.3.4` / `11.5`–`11.6`)."""

    fact_qty: Decimal = Field(ge=0, max_digits=14, decimal_places=3)
    shop_stage_code: str | None = Field(default=None, max_length=50)

    @field_validator("shop_stage_code", mode="before")
    @classmethod
    def strip_shop_stage_code(cls, value: object) -> object:
        if value is None:
            return None
        if isinstance(value, str):
            stripped = value.strip()
            return stripped or None
        return value


class TechnicalCardUnitLineWrite(BaseModel):
    unit_index: int = Field(ge=1)
    size_type: str | None = Field(default=None, max_length=20)
    size: str | None = Field(default=None, max_length=100)
    personalization: str | None = Field(default=None, max_length=500)
    print_number: str | None = Field(default=None, max_length=50)
    color: str | None = Field(
        default=None,
        max_length=100,
        description="Legacy nullable storage; not an active UI/import field (9.3.2.5).",
    )
    notes: str | None = None

    @field_validator("size_type", mode="before")
    @classmethod
    def normalize_size_type(cls, value: object) -> object:
        return _normalize_unit_line_size_type(value)

    @field_validator(
        "size",
        "personalization",
        "print_number",
        "color",
        mode="before",
    )
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
    source_kind: TechnicalCardOperationLineSourceKind = (
        TechnicalCardOperationLineSourceKind.ROUTING
    )
    tech_operation_id: int | None = Field(
        default=None,
        description="Soft catalog id for Stage 8.1.3 TechOperation",
    )
    sewing_operation_id: int | None = Field(
        default=None,
        description="SewingOperation id when source_kind=sewing",
    )
    operation_name: str = Field(min_length=1, max_length=255)
    volume_unit: TechOperationVolumeUnit
    volume: Decimal = Field(default=Decimal("0"), ge=0, max_digits=14, decimal_places=3)
    stage_order: int | None = Field(default=None, ge=1)
    production_stage_id: int | None = Field(default=None, ge=1)
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


class TechnicalCardMediaCreate(BaseModel):
    filename: str = Field(min_length=1, max_length=255)
    mime_type: str = Field(pattern=r"^image/(jpeg|png|webp)$")
    content_base64: str = Field(min_length=1)
    is_primary: bool = False


class TechnicalCardMediaUpdate(BaseModel):
    is_primary: bool | None = None


class TechnicalCardMediaRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    technical_card_id: int
    filename: str
    mime_type: str
    file_size: int
    sort_order: int
    is_primary: bool
    content_url: str
    created_at: datetime
    updated_at: datetime


class TechnicalCardAssemblySewingOpRead(BaseModel):
    sequence: int
    operation_name: str
    cost: Decimal
    quantity_per_item: int = 1
    line_total: Decimal
    duration_seconds: int
    sewing_operation_id: int | None = None


class TechnicalCardApplyRoutingRequest(BaseModel):
    routing_template_id: int = Field(ge=1)


class TechnicalCardStageResultWrite(BaseModel):
    stage_order: int = Field(ge=1)
    production_stage_id: int | None = Field(default=None, ge=1)
    stage_label: str = Field(min_length=1, max_length=255)
    status: TechnicalCardStageResultStatus = TechnicalCardStageResultStatus.PENDING
    performer_name: str | None = Field(default=None, max_length=255)
    started_at: datetime | None = None
    completed_at: datetime | None = None
    scrap_qty: Decimal | None = Field(default=None, ge=0, max_digits=14, decimal_places=3)
    rework_qty: Decimal | None = Field(default=None, ge=0, max_digits=14, decimal_places=3)
    notes: str | None = None
    work_done: str | None = None
    duration_seconds: int | None = Field(default=None, ge=0)
    work_center_id: int | None = Field(default=None, ge=1)

    @field_validator("stage_label", "performer_name", mode="before")
    @classmethod
    def strip_text(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value

    @field_validator("work_done", "notes", mode="before")
    @classmethod
    def strip_optional_text(cls, value: object) -> object:
        if isinstance(value, str):
            stripped = value.strip()
            return stripped or None
        return value


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
    work_done: str | None = None
    duration_seconds: int | None = Field(default=None, ge=0)

    @field_validator("performer_name", "notes", "work_done", mode="before")
    @classmethod
    def strip_text(cls, value: object) -> object:
        if isinstance(value, str):
            stripped = value.strip()
            return stripped or None
        return value


class TechnicalCardStageFactRequest(BaseModel):
    """Shop-module stage fact write (`11.4+` / `11.7.2`): performer / work done / duration / equipment."""

    performer_name: str | None = Field(default=None, max_length=255)
    work_done: str | None = None
    duration_seconds: int | None = Field(default=None, ge=0)
    scrap_qty: Decimal | None = Field(
        default=None, ge=0, max_digits=14, decimal_places=3
    )
    rework_qty: Decimal | None = Field(
        default=None, ge=0, max_digits=14, decimal_places=3
    )
    notes: str | None = None
    work_center_id: int | None = Field(default=None, ge=1)
    # When set, reject unless this stage maps to the given ProductionStage.code.
    shop_stage_code: str | None = Field(default=None, max_length=50)

    @field_validator("performer_name", "work_done", "notes", "shop_stage_code", mode="before")
    @classmethod
    def strip_text(cls, value: object) -> object:
        if isinstance(value, str):
            stripped = value.strip()
            return stripped or None
        return value


class TechnicalCardPlannedWorkCenterRequest(BaseModel):
    """Planning assign of equipment onto a stage (`11.1.2.4`); not shop fact."""

    work_center_id: int | None = Field(default=None, ge=1)


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
    product_model_cover_image_url: str | None = None

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

    order_number: str | None = None
    client_name: str | None = None
    responsible_name: str | None = None
    desired_date: date | None = None

    composition_lines: list[TechnicalCardCompositionLineRead] = Field(default_factory=list)
    unit_lines: list[TechnicalCardUnitLineRead] = Field(default_factory=list)
    operation_lines: list[TechnicalCardOperationLineRead] = Field(default_factory=list)
    stage_results: list[TechnicalCardStageResultRead] = Field(default_factory=list)
    media_items: list[TechnicalCardMediaRead] = Field(default_factory=list)
    assembly_sewing_operations: list[TechnicalCardAssemblySewingOpRead] = Field(
        default_factory=list
    )

    created_at: datetime
    updated_at: datetime


class TechnicalCardListRead(BaseModel):
    """Slim production list row (`0.2.3.3`) — scalars + stage_results only."""

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
    product_model_cover_image_url: str | None = None

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

    order_number: str | None = None
    client_name: str | None = None
    responsible_name: str | None = None
    desired_date: date | None = None

    stage_results: list[TechnicalCardStageResultRead] = Field(default_factory=list)

    created_at: datetime
    updated_at: datetime


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


class TechnicalCardSettingsRead(BaseModel):
    id: int
    eligible_nomenclature_types: list[str] = Field(default_factory=list)
    numbering_template: str
    unit_field_size_type_enabled: bool
    unit_field_size_enabled: bool
    unit_field_personalization_enabled: bool
    unit_field_print_number_enabled: bool
    unit_field_notes_enabled: bool
    stage_label_binding_mode: str
    created_at: datetime
    updated_at: datetime


class TechnicalCardSettingsUpdate(BaseModel):
    eligible_nomenclature_types: list[str] = Field(min_length=1)
    numbering_template: str = Field(min_length=1, max_length=120)
    unit_field_size_type_enabled: bool
    unit_field_size_enabled: bool
    unit_field_personalization_enabled: bool
    unit_field_print_number_enabled: bool
    unit_field_notes_enabled: bool
    stage_label_binding_mode: str = Field(min_length=1, max_length=30)

    @field_validator("eligible_nomenclature_types", mode="before")
    @classmethod
    def normalize_types(cls, value: object) -> object:
        if not isinstance(value, list):
            return value
        normalized: list[str] = []
        for item in value:
            if isinstance(item, str):
                stripped = item.strip().upper()
                if stripped:
                    normalized.append(stripped)
        return normalized

    @field_validator("numbering_template", "stage_label_binding_mode", mode="before")
    @classmethod
    def strip_required_text(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value

    @field_validator("stage_label_binding_mode")
    @classmethod
    def validate_stage_label_binding_mode(cls, value: str) -> str:
        if value != "snapshot":
            raise ValueError("stage_label_binding_mode supports only 'snapshot'")
        return value

    @field_validator("numbering_template")
    @classmethod
    def validate_numbering_template(cls, value: str) -> str:
        if "{orderNo}" not in value or "{cardSeq}" not in value:
            raise ValueError(
                "numbering_template must include both {orderNo} and {cardSeq}"
            )
        return value


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
# Active fields: unit_index, size_type (male/female), size, personalization, print_number, notes.
# `color` remains nullable legacy storage only.


class TechnicalCardUnitLineUpdate(BaseModel):
    """Partial per-row edit; unit_index is immutable via this payload."""

    size_type: str | None = Field(default=None, max_length=20)
    size: str | None = Field(default=None, max_length=100)
    personalization: str | None = Field(default=None, max_length=500)
    print_number: str | None = Field(default=None, max_length=50)
    color: str | None = Field(
        default=None,
        max_length=100,
        description="Legacy nullable storage; not an active UI/import field (9.3.2.5).",
    )
    notes: str | None = None

    @field_validator("size_type", mode="before")
    @classmethod
    def normalize_size_type(cls, value: object) -> object:
        return _normalize_unit_line_size_type(value)

    @field_validator(
        "size",
        "personalization",
        "print_number",
        "color",
        "notes",
        mode="before",
    )
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
    """Aggregate import rows; service expands them into N unit lines."""

    lines: list["TechnicalCardUnitLineImportRow"] = Field(min_length=1)


class TechnicalCardUnitLineImportRow(BaseModel):
    size_type: str | None = Field(default=None, max_length=20)
    size: str | None = Field(default=None, max_length=100)
    personalization: str | None = Field(default=None, max_length=500)
    print_number: str | None = Field(default=None, max_length=50)
    quantity: int = Field(ge=1)
    notes: str | None = None

    @field_validator("size_type", mode="before")
    @classmethod
    def normalize_size_type(cls, value: object) -> object:
        return _normalize_unit_line_size_type(value)

    @field_validator(
        "size",
        "personalization",
        "print_number",
        "notes",
        mode="before",
    )
    @classmethod
    def strip_import_text(cls, value: object) -> object:
        if isinstance(value, str):
            stripped = value.strip()
            return stripped if stripped else None
        return value


TechnicalCardUnitLinesImport.model_rebuild()


# --- Operation volume lines (Stage 9.3.3) ---


class TechnicalCardOperationLinesReplace(BaseModel):
    lines: list[TechnicalCardOperationLineWrite] = Field(default_factory=list)


class TechnicalCardOperationLineVolumeUpdate(BaseModel):
    """Manager or shop volume edit; stage binding stays stable after generate."""

    volume: Decimal = Field(ge=0, max_digits=14, decimal_places=3)
    operation_name: str | None = Field(default=None, min_length=1, max_length=255)
    shop_stage_code: str | None = Field(default=None, max_length=50)

    @field_validator("operation_name", "shop_stage_code", mode="before")
    @classmethod
    def strip_optional_text(cls, value: object) -> object:
        if isinstance(value, str):
            stripped = value.strip()
            return stripped or None
        return value


class TechnicalCardOperationLinesPrefillRead(BaseModel):
    """Soft prefill result: empty until TechOperation catalog `8.1.3` ships."""

    card: TechnicalCardRead
    prefilled: bool
    catalog_available: bool
    message: str
