from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.lead_card_fields import LEAD_CARD_FIELD_BLOCKS


class LeadCardFieldSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class LeadCardFieldDefinitionCreate(BaseModel):
    block: str
    label: str = Field(min_length=1, max_length=120)

    @field_validator("block")
    @classmethod
    def validate_block(cls, value: str) -> str:
        if value not in LEAD_CARD_FIELD_BLOCKS:
            raise ValueError("Unknown lead card field block")
        return value

    @field_validator("label")
    @classmethod
    def strip_label(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Label cannot be blank")
        return value


class LeadCardFieldDefinitionRead(LeadCardFieldSchema):
    id: int
    block: str
    label: str
    sort_order: int
    created_at: datetime
    updated_at: datetime


class LeadCardFieldValueItem(BaseModel):
    definition_id: int = Field(ge=1)
    value: str = Field(max_length=4000)


class LeadCardFieldValueWrite(BaseModel):
    items: list[LeadCardFieldValueItem] = Field(default_factory=list)


class LeadCardFieldValueRead(LeadCardFieldSchema):
    definition_id: int
    block: str
    label: str
    sort_order: int
    value: str
