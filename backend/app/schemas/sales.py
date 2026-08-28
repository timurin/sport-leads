from datetime import date, datetime
from decimal import Decimal
from enum import Enum

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator

from app.schemas.client_requisites import ClientBankAccountRead

from app.models.sales import (
    DesignApprovalStatus,
    MaterialReserveStatus,
    OrderPaymentStatus,
    LeadEventType,
    LeadContactChannel,
    LeadCustomerType,
    LeadResult,
    LeadStatus,
    SalesOrderStatus,
)


class SalesSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class LeadContactCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    position: str | None = Field(default=None, max_length=255)
    phone: str | None = Field(default=None, max_length=50)
    email: EmailStr | None = None
    preferred_channel: LeadContactChannel = LeadContactChannel.UNSPECIFIED
    is_primary: bool = False

    @field_validator("name")
    @classmethod
    def strip_contact_name(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Contact name cannot be blank")
        return value


class LeadContactUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    position: str | None = Field(default=None, max_length=255)
    phone: str | None = Field(default=None, max_length=50)
    email: EmailStr | None = None
    preferred_channel: LeadContactChannel | None = None

    @field_validator("name")
    @classmethod
    def strip_optional_contact_name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        if not value:
            raise ValueError("Contact name cannot be blank")
        return value


class LeadContactRead(SalesSchema):
    id: int
    lead_id: int
    name: str
    position: str | None
    phone: str | None
    email: str | None
    preferred_channel: LeadContactChannel
    is_primary: bool
    created_at: datetime
    updated_at: datetime


class LeadCreate(BaseModel):
    contact_name: str = Field(min_length=1, max_length=255)
    customer_type: LeadCustomerType | None = None
    company_name: str | None = Field(default=None, max_length=255)
    tax_id: str | None = Field(default=None, max_length=12, pattern=r"^(\d{10}|\d{12})$")
    website: str | None = Field(default=None, max_length=255)
    phone: str | None = Field(default=None, max_length=50)
    email: EmailStr | None = None
    city: str | None = Field(default=None, max_length=150)
    region: str | None = Field(default=None, max_length=150)
    address: str | None = Field(default=None, max_length=500)
    customer_comment: str | None = None
    source: str | None = Field(default=None, max_length=150)
    responsible_id: int | None = None
    sport: str | None = Field(default=None, max_length=150)
    product_category: str | None = Field(default=None, max_length=150)
    need_description: str | None = None
    estimated_quantity: int | None = Field(default=None, ge=1)
    estimated_amount: Decimal | None = Field(default=None, ge=0)
    desired_date: date | None = None

    @field_validator("contact_name")
    @classmethod
    def strip_lead_contact_name(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Contact name cannot be blank")
        return value


class LeadUpdate(BaseModel):
    status: str | None = Field(default=None, min_length=1, max_length=64, pattern=r"^[a-z][a-z0-9-]*$")
    customer_type: LeadCustomerType | None = None
    company_name: str | None = Field(default=None, max_length=255)
    tax_id: str | None = Field(default=None, max_length=12, pattern=r"^(\d{10}|\d{12})$")
    website: str | None = Field(default=None, max_length=255)
    contact_name: str | None = Field(default=None, min_length=1, max_length=255)
    phone: str | None = Field(default=None, max_length=50)
    email: EmailStr | None = None
    city: str | None = Field(default=None, max_length=150)
    region: str | None = Field(default=None, max_length=150)
    address: str | None = Field(default=None, max_length=500)
    customer_comment: str | None = None
    source: str | None = Field(default=None, max_length=150)
    responsible_id: int | None = None
    direction: str | None = Field(default=None, max_length=150)
    sport: str | None = Field(default=None, max_length=150)
    product_category: str | None = Field(default=None, max_length=150)
    product_type: str | None = Field(default=None, max_length=150)
    need_description: str | None = None
    estimated_quantity: int | None = Field(default=None, ge=1)
    kit_quantity: int | None = Field(default=None, ge=1)
    size_comment: str | None = None
    preliminary_budget: Decimal | None = Field(default=None, ge=0)
    estimated_amount: Decimal | None = Field(default=None, ge=0)
    discount_percent: Decimal | None = Field(default=None, ge=0, le=100)
    probability: Decimal | None = Field(default=None, ge=0, le=100)
    planned_order_date: date | None = None
    desired_date: date | None = None
    event_date: date | None = None
    delivery_city: str | None = Field(default=None, max_length=150)
    delivery_address: str | None = Field(default=None, max_length=500)
    delivery_method: str | None = Field(default=None, max_length=150)
    delivery_comment: str | None = None
    campaign: str | None = Field(default=None, max_length=255)
    utm_description: str | None = None
    priority: str | None = Field(default=None, max_length=20, pattern=r"^(low|medium|high|urgent)$")

    @model_validator(mode="after")
    def completed_requires_operation(self) -> "LeadUpdate":
        if self.status == LeadStatus.COMPLETED.value:
            raise ValueError("Use convert or reject to complete a lead")
        return self


class LeadRead(SalesSchema):
    id: int
    status: str
    result: LeadResult | None
    customer_type: LeadCustomerType | None
    company_name: str | None
    tax_id: str | None
    website: str | None
    contact_name: str
    phone: str | None
    email: str | None
    city: str | None
    region: str | None
    address: str | None
    customer_comment: str | None
    source: str | None
    responsible_id: int | None
    direction: str | None
    sport: str | None
    product_category: str | None
    product_type: str | None
    need_description: str | None
    estimated_quantity: int | None
    kit_quantity: int | None
    size_comment: str | None
    preliminary_budget: Decimal | None
    estimated_amount: Decimal | None
    discount_percent: Decimal | None
    probability: Decimal | None
    planned_order_date: date | None
    desired_date: date | None
    event_date: date | None
    delivery_city: str | None
    delivery_address: str | None
    delivery_method: str | None
    delivery_comment: str | None
    campaign: str | None
    utm_description: str | None
    priority: str | None
    completed_at: datetime | None
    completed_by_id: int | None
    converted_order_id: int | None
    rejection_reason_id: int | None
    rejection_comment: str | None
    created_at: datetime
    updated_at: datetime
    contacts: list[LeadContactRead] = Field(default_factory=list)


class LeadStageWrite(BaseModel):
    id: str = Field(min_length=1, max_length=64, pattern=r"^[a-z][a-z0-9-]*$")
    title: str = Field(min_length=1, max_length=100)
    accent_class: str = Field(min_length=1, max_length=32)
    is_active: bool
    sort_order: int = Field(ge=0)

    @field_validator("title")
    @classmethod
    def strip_stage_title(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Stage title cannot be blank")
        return value


class LeadStageRead(SalesSchema):
    id: str
    title: str
    accent_class: str
    is_active: bool
    sort_order: int
    is_system: bool
    created_at: datetime
    updated_at: datetime


class LeadStageConfigurationUpdate(BaseModel):
    stages: list[LeadStageWrite] = Field(min_length=1)
    transfers: dict[str, str] = Field(default_factory=dict)

    @model_validator(mode="after")
    def validate_unique_stage_configuration(self) -> "LeadStageConfigurationUpdate":
        ids = [stage.id for stage in self.stages]
        orders = [stage.sort_order for stage in self.stages]
        if len(ids) != len(set(ids)):
            raise ValueError("Stage identifiers must be unique")
        if len(orders) != len(set(orders)):
            raise ValueError("Stage sort orders must be unique")
        if not any(stage.is_active for stage in self.stages):
            raise ValueError("At least one active stage is required")
        return self


class LeadRejectionReasonCreate(BaseModel):
    code: str = Field(min_length=1, max_length=100, pattern=r"^[a-z0-9_]+$")
    name: str = Field(min_length=1, max_length=255)
    category: str = Field(min_length=1, max_length=100)
    requires_comment: bool = False
    is_active: bool = True
    sort_order: int = Field(default=0, ge=0)

    @field_validator("code", "name", "category")
    @classmethod
    def strip_required_text(cls, value: str) -> str:
        return value.strip()


class LeadRejectionReasonUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    category: str | None = Field(default=None, min_length=1, max_length=100)
    requires_comment: bool | None = None
    is_active: bool | None = None
    sort_order: int | None = Field(default=None, ge=0)


class LeadRejectionReasonRead(SalesSchema):
    id: int
    code: str
    name: str
    category: str
    requires_comment: bool
    is_active: bool
    sort_order: int
    created_at: datetime
    updated_at: datetime


class LeadConvertRequest(BaseModel):
    completed_by_id: int = Field(default=1, ge=1)
    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    product_category: str | None = Field(default=None, max_length=150)
    sport: str | None = Field(default=None, max_length=150)
    quantity: int | None = Field(default=None, ge=1)
    amount: Decimal | None = Field(default=None, ge=0)
    desired_date: date | None = None
    source: str | None = Field(default=None, max_length=150)
    responsible_id: int | None = None
    company_name: str | None = Field(default=None, max_length=255)
    contact_name: str | None = Field(default=None, min_length=1, max_length=255)
    phone: str | None = Field(default=None, max_length=50)
    email: EmailStr | None = None
    city: str | None = Field(default=None, max_length=150)


class LeadRejectRequest(BaseModel):
    rejection_reason_id: int
    comment: str | None = None
    completed_by_id: int = Field(default=1, ge=1)

    @field_validator("comment")
    @classmethod
    def normalize_comment(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return value.strip() or None


class SalesOrderRead(SalesSchema):
    id: int
    number: str
    lead_id: int | None
    client_id: int
    organization_id: int | None
    status: SalesOrderStatus
    design_approval_status: DesignApprovalStatus = DesignApprovalStatus.NOT_REQUIRED
    payment_status: OrderPaymentStatus = OrderPaymentStatus.UNPAID
    paid_amount: Decimal = Decimal("0.00")
    material_reserve_status: MaterialReserveStatus = MaterialReserveStatus.NOT_REQUIRED
    responsible_id: int | None
    title: str
    description: str | None
    product_category: str | None
    sport: str | None
    quantity: int | None
    amount: Decimal | None
    discount_percent: Decimal | None = None
    discount_amount: Decimal = Decimal("0.00")
    vat_amount: Decimal = Decimal("0.00")
    currency_code: str = "RUB"
    items_subtotal: Decimal | None = None
    amount_net: Decimal | None = None
    desired_date: date | None
    tech_cards_planned_count: int | None = None
    source: str | None
    created_at: datetime
    updated_at: datetime
    client_name: str | None = None
    responsible_name: str | None = None
    organization_name: str | None = None
    items: list["SalesOrderItemRead"] = []


class SalesOrderCreate(BaseModel):
    """Direct create without Lead (`0.4` / SL-ORDER-WITHOUT-LEAD-v1)."""

    client_id: int
    organization_id: int | None = None
    responsible_id: int
    title: str = Field(min_length=1, max_length=255)
    number: str | None = Field(default=None, max_length=50)
    description: str | None = None
    product_category: str | None = Field(default=None, max_length=150)
    sport: str | None = Field(default=None, max_length=150)
    quantity: int | None = Field(default=None, ge=0)
    amount: Decimal | None = None
    desired_date: date | None = None
    source: str | None = Field(default=None, max_length=150)
    currency_code: str = Field(default="RUB", min_length=3, max_length=3)

    @field_validator("title", "number", "description", "product_category", "sport", "source", mode="before")
    @classmethod
    def _strip_optional_text(cls, value: object) -> object:
        if isinstance(value, str):
            return value.strip()
        return value

    @field_validator("currency_code")
    @classmethod
    def _currency_upper(cls, value: str) -> str:
        return value.strip().upper()


class SalesOrderDiscountUpdate(BaseModel):
    discount_percent: Decimal | None = Field(default=None, ge=0, le=100, max_digits=5, decimal_places=2)


class SalesOrderTechCardsPlannedCountUpdate(BaseModel):
    """Soft planned TC count on the sales order (Stage 28.1). Null clears the field."""

    tech_cards_planned_count: int | None = Field(default=None, ge=1)


class SalesOrderClientNeedUpdate(BaseModel):
    """Need / commercial parity fields on order (`20.4.2`); optional sync to source lead."""

    description: str | None = None
    product_category: str | None = Field(default=None, max_length=150)
    sport: str | None = Field(default=None, max_length=150)
    quantity: int | None = Field(default=None, ge=0)
    desired_date: date | None = None
    source: str | None = Field(default=None, max_length=150)
    sync_to_lead: bool = True

    @field_validator(
        "description",
        "product_category",
        "sport",
        "source",
        mode="before",
    )
    @classmethod
    def _strip_optional_text(cls, value: object) -> object:
        if isinstance(value, str):
            stripped = value.strip()
            return stripped or None
        return value


class SalesOrderItemVariantSnapshotRead(SalesSchema):
    characteristic_id: int
    characteristic_code: str
    characteristic_name: str
    option_id: int
    option_code: str
    option_label: str


class SalesOrderItemAssemblyOperationSnapshotRead(SalesSchema):
    sequence: int
    operation_name: str
    cost: Decimal
    quantity_per_item: int = 1
    duration_seconds: int
    sewing_operation_id: int | None = None


class SalesOrderItemRead(SalesSchema):
    id: int
    order_id: int
    nomenclature_id: int | None
    nomenclature_variant_id: int | None
    product_model_id: int | None = None
    product_model_article: str | None = None
    product_model_name: str | None = None
    product_model_size_type: str | None = None
    assembly_variant_id: int | None = None
    assembly_variant_name: str | None = None
    assembly_variant_total_cost: Decimal | None = None
    routing_template_id: int | None = None
    routing_template_name: str | None = None
    vat_rate_id: int | None = None
    vat_rate_percent: Decimal | None = None
    price_includes_vat: bool = True
    vat_amount: Decimal = Decimal("0.00")
    position: int
    snapshot_name: str
    size_range: str | None
    personalization: str | None
    color: str | None
    unit: str
    quantity: Decimal
    unit_price: Decimal
    gross_amount: Decimal
    discount_percent: Decimal | None
    discount_amount: Decimal
    line_amount: Decimal
    line_total: Decimal | None = None
    created_at: datetime
    updated_at: datetime
    variant_snapshots: list[SalesOrderItemVariantSnapshotRead] = Field(default_factory=list)
    assembly_operation_snapshots: list[SalesOrderItemAssemblyOperationSnapshotRead] = Field(
        default_factory=list
    )


class SalesOrderItemCreate(BaseModel):
    nomenclature_id: int | None = None
    nomenclature_variant_id: int | None = None
    product_model_id: int | None = None
    product_model_article: str | None = Field(default=None, max_length=100)
    product_model_name: str | None = Field(default=None, max_length=255)
    assembly_variant_id: int | None = None
    routing_template_id: int | None = None
    vat_rate_id: int | None = None
    price_includes_vat: bool = True
    snapshot_name: str = Field(min_length=1, max_length=255)
    size_range: str | None = Field(default=None, max_length=255)
    personalization: str | None = Field(default=None, max_length=500)
    color: str | None = Field(default=None, max_length=100)
    unit: str = Field(default="шт", min_length=1, max_length=30)
    quantity: Decimal = Field(gt=0, max_digits=14, decimal_places=3)
    unit_price: Decimal = Field(ge=0, max_digits=14, decimal_places=2)
    discount_percent: Decimal | None = Field(default=None, ge=0, le=100, max_digits=5, decimal_places=2)


class SalesOrderItemUpdate(BaseModel):
    nomenclature_id: int | None = None
    nomenclature_variant_id: int | None = None
    product_model_id: int | None = None
    product_model_article: str | None = Field(default=None, max_length=100)
    product_model_name: str | None = Field(default=None, max_length=255)
    assembly_variant_id: int | None = None
    routing_template_id: int | None = None
    vat_rate_id: int | None = None
    price_includes_vat: bool | None = None
    snapshot_name: str | None = Field(default=None, min_length=1, max_length=255)
    size_range: str | None = Field(default=None, max_length=255)
    personalization: str | None = Field(default=None, max_length=500)
    color: str | None = Field(default=None, max_length=100)
    unit: str | None = Field(default=None, min_length=1, max_length=30)
    quantity: Decimal | None = Field(default=None, gt=0, max_digits=14, decimal_places=3)
    unit_price: Decimal | None = Field(default=None, ge=0, max_digits=14, decimal_places=2)
    discount_percent: Decimal | None = Field(default=None, ge=0, le=100, max_digits=5, decimal_places=2)


class OrganizationRead(SalesSchema):
    id: int
    name: str
    legal_form: str | None
    tax_id: str | None
    ogrn: str | None = None
    kpp: str | None
    tax_system: str | None
    director: str | None
    legal_address: str | None
    is_active: bool
    created_at: datetime
    updated_at: datetime


def _org_blank_to_none(value: object) -> object:
    if isinstance(value, str):
        stripped = value.strip()
        return stripped or None
    return value


class OrganizationCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    legal_form: str | None = Field(default=None, max_length=50)
    tax_id: str | None = Field(default=None, max_length=12, pattern=r"^(\d{10}|\d{12})$")
    ogrn: str | None = Field(default=None, max_length=15, pattern=r"^(\d{13}|\d{15})$")
    kpp: str | None = Field(default=None, max_length=9, pattern=r"^\d{9}$")
    tax_system: str | None = Field(default=None, max_length=100)
    director: str | None = Field(default=None, max_length=255)
    legal_address: str | None = Field(default=None, max_length=500)
    is_active: bool = True

    @field_validator("name", mode="before")
    @classmethod
    def strip_name(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value

    @field_validator(
        "legal_form",
        "tax_id",
        "ogrn",
        "kpp",
        "tax_system",
        "director",
        "legal_address",
        mode="before",
    )
    @classmethod
    def blank_to_none(cls, value: object) -> object:
        return _org_blank_to_none(value)


class OrganizationUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    legal_form: str | None = Field(default=None, max_length=50)
    tax_id: str | None = Field(default=None, max_length=12, pattern=r"^(\d{10}|\d{12})$")
    ogrn: str | None = Field(default=None, max_length=15, pattern=r"^(\d{13}|\d{15})$")
    kpp: str | None = Field(default=None, max_length=9, pattern=r"^\d{9}$")
    tax_system: str | None = Field(default=None, max_length=100)
    director: str | None = Field(default=None, max_length=255)
    legal_address: str | None = Field(default=None, max_length=500)
    is_active: bool | None = None

    @field_validator("name", mode="before")
    @classmethod
    def strip_name(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value

    @field_validator(
        "legal_form",
        "tax_id",
        "ogrn",
        "kpp",
        "tax_system",
        "director",
        "legal_address",
        mode="before",
    )
    @classmethod
    def blank_to_none(cls, value: object) -> object:
        return _org_blank_to_none(value)


class EmployeeRead(SalesSchema):
    id: int
    full_name: str
    organization_id: int
    organization_name: str
    position: str | None
    department: str | None
    phone: str | None
    email: str | None
    employment_date: date | None
    is_active: bool
    created_at: datetime
    updated_at: datetime


class EmployeeCreate(BaseModel):
    full_name: str = Field(min_length=1, max_length=255)
    organization_id: int
    position: str | None = Field(default=None, max_length=150)
    department: str | None = Field(default=None, max_length=150)
    phone: str | None = Field(default=None, max_length=50)
    email: EmailStr | None = None
    employment_date: date | None = None
    is_active: bool = True

    @field_validator("full_name", mode="before")
    @classmethod
    def strip_full_name(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value

    @field_validator("position", "department", "phone", "email", mode="before")
    @classmethod
    def blank_to_none(cls, value: object) -> object:
        return _org_blank_to_none(value)

    @field_validator("employment_date", mode="before")
    @classmethod
    def blank_date_to_none(cls, value: object) -> object:
        if value == "":
            return None
        return value


class EmployeeUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=1, max_length=255)
    organization_id: int | None = None
    position: str | None = Field(default=None, max_length=150)
    department: str | None = Field(default=None, max_length=150)
    phone: str | None = Field(default=None, max_length=50)
    email: EmailStr | None = None
    employment_date: date | None = None
    is_active: bool | None = None

    @field_validator("full_name", mode="before")
    @classmethod
    def strip_full_name(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value

    @field_validator("position", "department", "phone", "email", mode="before")
    @classmethod
    def blank_to_none(cls, value: object) -> object:
        return _org_blank_to_none(value)

    @field_validator("employment_date", mode="before")
    @classmethod
    def blank_date_to_none(cls, value: object) -> object:
        if value == "":
            return None
        return value


class ClientListItem(SalesSchema):
    """List row for `/clients` (2.2.1). Aggregates from `sales_orders` when present."""

    id: int
    company_name: str | None
    contact_name: str
    phone: str | None
    email: str | None
    city: str | None
    responsible_id: int | None
    responsible_name: str | None = None
    organization_id: int | None = None
    organization_name: str | None = None
    """Resolved for order create: FK, else last order org, else name match."""
    default_organization_id: int | None = None
    orders_count: int = 0
    sales_amount: Decimal = Decimal("0.00")
    primary_sport: str | None = None
    folder_id: int | None = None
    folder_name: str | None = None
    created_at: datetime
    updated_at: datetime


class ClientCreate(BaseModel):
    """Create client (+ optional default organization) for order-without-lead UX."""

    contact_name: str = Field(min_length=1, max_length=255)
    company_name: str | None = Field(default=None, max_length=255)
    phone: str | None = Field(default=None, max_length=50)
    email: EmailStr | None = None
    city: str | None = Field(default=None, max_length=150)
    responsible_id: int | None = None
    folder_id: int | None = None
    organization_id: int | None = None
    organization_name: str | None = Field(default=None, max_length=255)
    tax_id: str | None = Field(default=None, max_length=12)
    inn: str | None = Field(default=None, max_length=12, pattern=r"^(\d{10}|\d{12})$")
    ogrn: str | None = Field(default=None, max_length=15)

    @field_validator("contact_name")
    @classmethod
    def _require_contact(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Contact name cannot be blank")
        return value

    @field_validator(
        "company_name",
        "phone",
        "city",
        "organization_name",
        "tax_id",
        "inn",
        "ogrn",
        mode="before",
    )
    @classmethod
    def _blank_to_none(cls, value: object) -> object:
        if isinstance(value, str):
            stripped = value.strip()
            return stripped or None
        return value


class ClientOrderSummary(SalesSchema):
    id: int
    number: str
    title: str
    status: SalesOrderStatus
    amount: Decimal | None = None
    sport: str | None = None
    created_at: datetime


class ClientDetailRead(ClientListItem):
    """Card payload for `/clients/{id}` (2.2.2). Requisites `2.3.1` live only on detail."""

    inn: str | None = None
    kpp: str | None = None
    ogrn: str | None = None
    legal_address: str | None = None
    actual_address: str | None = None
    bank_accounts: list[ClientBankAccountRead] = []
    segments: list[str] = []
    recent_orders: list[ClientOrderSummary] = []


class SalesOrderOrganizationUpdate(BaseModel):
    organization_id: int | None = None


class SalesOrderClientUpdate(BaseModel):
    client_id: int


class SalesOrderStatusUpdate(BaseModel):
    status: SalesOrderStatus


class SalesOrderDesignApprovalUpdate(BaseModel):
    design_approval_status: DesignApprovalStatus


class SalesOrderPaymentUpdate(BaseModel):
    payment_status: OrderPaymentStatus | None = None
    paid_amount: Decimal | None = Field(default=None, ge=0, max_digits=14, decimal_places=2)

    @model_validator(mode="after")
    def require_at_least_one(self) -> "SalesOrderPaymentUpdate":
        if self.payment_status is None and self.paid_amount is None:
            raise ValueError("Provide payment_status and/or paid_amount")
        return self


class SalesOrderMaterialReserveUpdate(BaseModel):
    material_reserve_status: MaterialReserveStatus


class CommercialDocumentStatus(str, Enum):
    DRAFT = "draft"
    ISSUED = "issued"
    CANCELLED = "cancelled"


class SalesCommercialLineRead(SalesSchema):
    id: int
    source_order_item_id: int | None = None
    position: int
    snapshot_name: str
    unit: str
    quantity: Decimal
    unit_price: Decimal
    discount_percent: Decimal | None = None
    discount_amount: Decimal
    line_amount: Decimal
    vat_rate_id: int | None = None
    vat_rate_percent: Decimal | None = None
    price_includes_vat: bool = True
    vat_amount: Decimal
    line_total: Decimal


class SalesQuotationRead(SalesSchema):
    id: int
    number: str
    sales_order_id: int
    status: CommercialDocumentStatus
    currency_code: str
    discount_percent: Decimal | None = None
    discount_amount: Decimal
    vat_amount: Decimal
    amount: Decimal
    amount_net: Decimal
    created_at: datetime
    updated_at: datetime
    items: list[SalesCommercialLineRead] = Field(default_factory=list)


class SalesInvoiceRead(SalesSchema):
    id: int
    number: str
    sales_order_id: int
    quotation_id: int | None = None
    status: CommercialDocumentStatus
    currency_code: str
    discount_percent: Decimal | None = None
    discount_amount: Decimal
    vat_amount: Decimal
    amount: Decimal
    amount_net: Decimal
    created_at: datetime
    updated_at: datetime
    items: list[SalesCommercialLineRead] = Field(default_factory=list)


class SalesInvoiceCreate(BaseModel):
    quotation_id: int | None = None


class LeadConversionRead(BaseModel):
    lead: LeadRead
    order: SalesOrderRead


class LeadEventRead(SalesSchema):
    id: int
    lead_id: int | None
    order_id: int | None
    event_type: LeadEventType
    actor_id: int | None
    message: str | None
    created_at: datetime


_LEAD_TASK_TYPE_PATTERN = (
    r"^(call|message|email|send_proposal|clarify_sizes|receive_design|"
    r"approve_design|check_payment|meeting|other)$"
)
_LEAD_TASK_PRIORITY_PATTERN = r"^(low|medium|high|urgent)$"


class SalesUserRead(SalesSchema):
    id: int
    name: str
    is_active: bool
    created_at: datetime


class LeadTaskCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    task_type: str = Field(default="other", max_length=50, pattern=_LEAD_TASK_TYPE_PATTERN)
    priority: str = Field(default="medium", max_length=20, pattern=_LEAD_TASK_PRIORITY_PATTERN)
    description: str | None = Field(default=None, max_length=3000)
    due_at: datetime
    assigned_to_id: int | None = None
    created_by_id: int | None = None

    @field_validator("title")
    @classmethod
    def strip_title(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Task title cannot be blank")
        return value

    @field_validator("description")
    @classmethod
    def strip_description(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        return value or None


class LeadTaskUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    task_type: str | None = Field(default=None, max_length=50, pattern=_LEAD_TASK_TYPE_PATTERN)
    priority: str | None = Field(default=None, max_length=20, pattern=_LEAD_TASK_PRIORITY_PATTERN)
    description: str | None = Field(default=None, max_length=3000)
    due_at: datetime | None = None
    assigned_to_id: int | None = None

    @field_validator("title")
    @classmethod
    def strip_optional_title(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        if not value:
            raise ValueError("Task title cannot be blank")
        return value

    @field_validator("description")
    @classmethod
    def strip_optional_description(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        return value or None


class LeadTaskCompleteRequest(BaseModel):
    result: str | None = Field(default=None, max_length=3000)

    @field_validator("result")
    @classmethod
    def strip_result(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        return value or None


class LeadTaskRead(SalesSchema):
    id: int
    lead_id: int
    title: str
    task_type: str
    priority: str
    description: str | None
    result: str | None
    status: str
    due_at: datetime | None
    assigned_to_id: int | None
    assigned_to_name: str | None = None
    created_by_id: int | None
    created_by_name: str | None = None
    created_at: datetime
    completed_at: datetime | None


class LeadNoteCreate(BaseModel):
    body: str = Field(min_length=1, max_length=10000)
    author_id: int | None = None
    mentioned_user_ids: list[int] = Field(default_factory=list)

    @field_validator("body")
    @classmethod
    def strip_body(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Note body cannot be blank")
        return value


class LeadNoteUpdate(BaseModel):
    body: str | None = Field(default=None, min_length=1, max_length=10000)
    mentioned_user_ids: list[int] | None = None

    @field_validator("body")
    @classmethod
    def strip_optional_body(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        if not value:
            raise ValueError("Note body cannot be blank")
        return value


class LeadNoteRead(SalesSchema):
    id: int
    lead_id: int
    body: str
    author_id: int | None
    author_name: str | None = None
    is_pinned: bool
    mentioned_user_ids: list[int] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime


_LEAD_MESSAGE_CHANNEL_PATTERN = r"^(phone|email|telegram|whatsapp|vk|website|internal)$"
_LEAD_MESSAGE_STATUS_PATTERN = r"^(draft|sending|sent|delivered|read|failed)$"


class LeadMessageAttachmentPayload(BaseModel):
    id: str = Field(min_length=1, max_length=100)
    name: str = Field(min_length=1, max_length=255)
    type: str | None = Field(default=None, max_length=150)
    size: int | None = Field(default=None, ge=0)


class LeadMessageCreate(BaseModel):
    channel: str = Field(max_length=30, pattern=_LEAD_MESSAGE_CHANNEL_PATTERN)
    text: str = Field(default="", max_length=5000)
    recipient_name: str | None = Field(default=None, max_length=255)
    author_id: int | None = None
    attachments: list[LeadMessageAttachmentPayload] = Field(default_factory=list)

    @field_validator("text")
    @classmethod
    def strip_text(cls, value: str) -> str:
        return value.strip()

    @model_validator(mode="after")
    def require_text_or_attachment(self) -> "LeadMessageCreate":
        if not self.text and not self.attachments:
            raise ValueError("Message text or an attachment is required")
        if self.channel == "phone":
            raise ValueError("The phone channel does not support text messages")
        return self


class LeadMessageRead(SalesSchema):
    id: int
    lead_id: int
    channel: str
    direction: str
    text: str
    status: str
    author_id: int | None
    author_name: str | None = None
    sender_name: str | None
    recipient_name: str | None
    external_id: str | None
    attachments: list[LeadMessageAttachmentPayload] = Field(default_factory=list)
    is_mock: bool
    sent_at: datetime
    created_at: datetime
