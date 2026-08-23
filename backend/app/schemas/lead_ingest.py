from pydantic import BaseModel, EmailStr, Field, field_validator

from app.schemas.sales import LeadRead


class WebsiteFormWebhookPayload(BaseModel):
    external_id: str = Field(min_length=1, max_length=255)
    contact_name: str = Field(min_length=1, max_length=255)
    phone: str | None = Field(default=None, max_length=50)
    email: EmailStr | None = None
    company_name: str | None = Field(default=None, max_length=255)
    city: str | None = Field(default=None, max_length=150)
    comment: str | None = None
    source: str | None = Field(default=None, max_length=150)
    sport: str | None = Field(default=None, max_length=150)

    @field_validator("external_id", "contact_name")
    @classmethod
    def strip_required_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Value cannot be blank")
        return value


class NormalizedLeadIngest(BaseModel):
    adapter_type: str
    external_id: str
    contact_name: str
    phone: str | None = None
    email: EmailStr | None = None
    company_name: str | None = None
    city: str | None = None
    comment: str | None = None
    source_label: str
    sport: str | None = None


class LeadIngestRead(BaseModel):
    created: bool
    matched_existing: bool
    duplicate_ingest: bool
    adapter_type: str
    external_id: str
    lead: LeadRead
