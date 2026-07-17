from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator

from app.models.sales import (
    LeadEventType,
    LeadContactChannel,
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


class LeadUpdate(BaseModel):
    status: LeadStatus | None = None
    company_name: str | None = Field(default=None, max_length=255)
    contact_name: str | None = Field(default=None, min_length=1, max_length=255)
    phone: str | None = Field(default=None, max_length=50)
    email: EmailStr | None = None
    city: str | None = Field(default=None, max_length=150)
    source: str | None = Field(default=None, max_length=150)
    responsible_id: int | None = None
    sport: str | None = Field(default=None, max_length=150)
    product_category: str | None = Field(default=None, max_length=150)
    need_description: str | None = None
    estimated_quantity: int | None = Field(default=None, ge=1)
    estimated_amount: Decimal | None = Field(default=None, ge=0)
    desired_date: date | None = None

    @model_validator(mode="after")
    def completed_requires_operation(self) -> "LeadUpdate":
        if self.status == LeadStatus.COMPLETED:
            raise ValueError("Use convert or reject to complete a lead")
        return self


class LeadRead(SalesSchema):
    id: int
    status: LeadStatus
    result: LeadResult | None
    company_name: str | None
    contact_name: str
    phone: str | None
    email: str | None
    city: str | None
    source: str | None
    responsible_id: int | None
    sport: str | None
    product_category: str | None
    need_description: str | None
    estimated_quantity: int | None
    estimated_amount: Decimal | None
    desired_date: date | None
    completed_at: datetime | None
    completed_by_id: int | None
    converted_order_id: int | None
    rejection_reason_id: int | None
    rejection_comment: str | None
    created_at: datetime
    updated_at: datetime
    contacts: list[LeadContactRead] = Field(default_factory=list)


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
