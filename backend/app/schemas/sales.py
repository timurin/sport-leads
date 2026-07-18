from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator

from app.models.sales import (
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
    lead_id: int
    client_id: int
    organization_id: int | None
    status: SalesOrderStatus
    responsible_id: int | None
    title: str
    description: str | None
    product_category: str | None
    sport: str | None
    quantity: int | None
    amount: Decimal | None
    desired_date: date | None
    source: str | None
    created_at: datetime
    updated_at: datetime
    client_name: str | None = None
    responsible_name: str | None = None
    organization_name: str | None = None
    items: list["SalesOrderItemRead"] = []


class SalesOrderItemRead(SalesSchema):
    id: int
    order_id: int
    position: int
    snapshot_name: str
    size_range: str | None
    personalization: str | None
    unit: str
    quantity: Decimal
    unit_price: Decimal
    line_amount: Decimal
    created_at: datetime
    updated_at: datetime


class SalesOrderItemCreate(BaseModel):
    snapshot_name: str = Field(min_length=1, max_length=255)
    size_range: str | None = Field(default=None, max_length=255)
    personalization: str | None = Field(default=None, max_length=500)
    unit: str = Field(default="шт", min_length=1, max_length=30)
    quantity: Decimal = Field(gt=0, max_digits=14, decimal_places=3)
    unit_price: Decimal = Field(ge=0, max_digits=14, decimal_places=2)


class SalesOrderItemUpdate(BaseModel):
    snapshot_name: str | None = Field(default=None, min_length=1, max_length=255)
    size_range: str | None = Field(default=None, max_length=255)
    personalization: str | None = Field(default=None, max_length=500)
    unit: str | None = Field(default=None, min_length=1, max_length=30)
    quantity: Decimal | None = Field(default=None, gt=0, max_digits=14, decimal_places=3)
    unit_price: Decimal | None = Field(default=None, ge=0, max_digits=14, decimal_places=2)


class OrganizationRead(SalesSchema):
    id: int
    name: str
    legal_form: str | None
    tax_id: str | None
    kpp: str | None
    tax_system: str | None
    director: str | None
    legal_address: str | None
    is_active: bool
    created_at: datetime
    updated_at: datetime


class SalesOrderOrganizationUpdate(BaseModel):
    organization_id: int | None = None


class SalesOrderStatusUpdate(BaseModel):
    status: SalesOrderStatus


class LeadConversionRead(BaseModel):
    lead: LeadRead
    order: SalesOrderRead


class LeadEventRead(SalesSchema):
    id: int
    lead_id: int
    order_id: int | None
    event_type: LeadEventType
    actor_id: int | None
    message: str | None
    created_at: datetime
