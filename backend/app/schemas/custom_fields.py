from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.custom_fields import CustomFieldDataType


class CustomFieldDefinitionCreate(BaseModel):
    code: str = Field(min_length=1, max_length=100, pattern=r"^[a-z0-9][a-z0-9_-]*$")
    name: str = Field(min_length=1, max_length=255)
    description: str | None = None
    data_type: CustomFieldDataType
    unit_id: int | None = None
    is_searchable: bool = False
    is_filterable: bool = False
    is_visible: bool = True

    @field_validator("code", "name", mode="before")
    @classmethod
    def strip_text(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value


class CustomFieldDefinitionUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    unit_id: int | None = None
    is_searchable: bool | None = None
    is_filterable: bool | None = None
    is_visible: bool | None = None
    is_active: bool | None = None


class CustomFieldDefinitionRead(CustomFieldDefinitionCreate):
    model_config = ConfigDict(from_attributes=True)
    id: int
    is_active: bool
    is_system: bool
    created_at: datetime
    updated_at: datetime


class CustomFieldOptionCreate(BaseModel):
    code: str = Field(min_length=1, max_length=100, pattern=r"^[a-z0-9][a-z0-9_-]*$")
    label: str = Field(min_length=1, max_length=255)
    sort_order: int = Field(default=0, ge=0)


class CustomFieldOptionUpdate(BaseModel):
    label: str | None = Field(default=None, min_length=1, max_length=255)
    sort_order: int | None = Field(default=None, ge=0)
    is_active: bool | None = None


class CustomFieldOptionRead(CustomFieldOptionCreate):
    model_config = ConfigDict(from_attributes=True)
    id: int
    field_definition_id: int
    is_active: bool
    created_at: datetime
    updated_at: datetime


class CategoryFieldCreate(BaseModel):
    field_definition_id: int
    is_required: bool = False
    inherit: bool = True
    is_visible: bool = True
    sort_order: int = Field(default=0, ge=0)
    default_value: object | None = None


class CategoryFieldUpdate(BaseModel):
    is_required: bool | None = None
    inherit: bool | None = None
    is_visible: bool | None = None
    sort_order: int | None = Field(default=None, ge=0)
    default_value: object | None = None


class CategoryFieldRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    category_id: int
    field_definition_id: int
    is_required: bool
    inherit: bool
    is_visible: bool
    sort_order: int
    default_value: object | None = None
    source_category_id: int
    inherited: bool = False


class NomenclatureFieldValueInput(BaseModel):
    field_definition_id: int
    value: object | None = None


class NomenclatureFieldValueRead(BaseModel):
    field_definition_id: int
    code: str
    name: str
    data_type: CustomFieldDataType
    value: object | None = None
    is_required: bool
    inherited: bool
    source_category_id: int
