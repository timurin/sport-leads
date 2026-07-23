from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

CharacteristicKind = Literal[
    "STRING",
    "TEXT",
    "INTEGER",
    "DECIMAL",
    "BOOLEAN",
    "DATE",
    "LIST",
    "MULTI_SELECT",
    "COLOR",
]


class CharacteristicDefinitionCreate(BaseModel):
    code: str | None = Field(default=None, max_length=100, pattern=r"^[a-z0-9][a-z0-9_-]*$")
    name: str = Field(min_length=1, max_length=255)
    kind: CharacteristicKind = "LIST"
    description: str | None = None
    unit_id: int | None = None
    is_variant_dimension: bool = False
    is_searchable: bool = False
    is_filterable: bool = False
    is_visible: bool = True

    @field_validator("code", "name", "description", mode="before")
    @classmethod
    def strip_text(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value


class CharacteristicDefinitionUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    unit_id: int | None = None
    is_searchable: bool | None = None
    is_filterable: bool | None = None
    is_visible: bool | None = None
    is_active: bool | None = None

    @field_validator("name", "description", mode="before")
    @classmethod
    def strip_text(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value


class CharacteristicDefinitionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    code: str
    name: str
    kind: CharacteristicKind
    description: str | None = None
    unit_id: int | None = None
    is_variant_dimension: bool
    is_searchable: bool
    is_filterable: bool
    is_visible: bool
    is_active: bool
    is_system: bool
    created_at: datetime
    updated_at: datetime
    can_delete: bool = True


class CharacteristicOptionCreate(BaseModel):
    code: str = Field(min_length=1, max_length=100, pattern=r"^[a-z0-9][a-z0-9_-]*$")
    label: str = Field(min_length=1, max_length=255)
    sort_order: int = Field(default=0, ge=0)
    hex_value: str | None = Field(default=None, pattern=r"^#[0-9A-Fa-f]{6}$")

    @field_validator("code", "label")
    @classmethod
    def strip_text(cls, value: str) -> str:
        return value.strip()


class CharacteristicOptionUpdate(BaseModel):
    label: str | None = Field(default=None, min_length=1, max_length=255)
    sort_order: int | None = Field(default=None, ge=0)
    hex_value: str | None = Field(default=None, pattern=r"^#[0-9A-Fa-f]{6}$")
    is_active: bool | None = None

    @field_validator("label", mode="before")
    @classmethod
    def strip_text(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value


class CharacteristicOptionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    characteristic_id: int
    code: str
    label: str
    sort_order: int
    hex_value: str | None = None
    is_active: bool
    created_at: datetime
    updated_at: datetime
    can_delete: bool = True


class CategoryCharacteristicCreate(BaseModel):
    characteristic_id: int
    is_required: bool = False
    inherit: bool = True
    is_visible: bool = True
    sort_order: int = Field(default=0, ge=0)
    default_value: object | None = None


class CategoryCharacteristicUpdate(BaseModel):
    is_required: bool | None = None
    inherit: bool | None = None
    is_visible: bool | None = None
    sort_order: int | None = Field(default=None, ge=0)
    default_value: object | None = None


class CategoryCharacteristicRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    category_id: int
    characteristic_id: int
    is_required: bool
    inherit: bool
    is_visible: bool
    sort_order: int
    default_value: object | None = None
    created_at: datetime
    updated_at: datetime
    inherited: bool = False
    source_category_id: int


class NomenclatureCharacteristicCreate(BaseModel):
    characteristic_id: int


class NomenclatureCharacteristicRead(NomenclatureCharacteristicCreate):
    model_config = ConfigDict(from_attributes=True)

    id: int
    nomenclature_id: int
    created_at: datetime
    updated_at: datetime


class NomenclatureCharacteristicValueInput(BaseModel):
    characteristic_id: int
    value: object | None = None


class NomenclatureCharacteristicAssignmentInput(BaseModel):
    characteristic_id: int


class NomenclatureCharacteristicValueRead(BaseModel):
    characteristic_id: int
    code: str
    name: str
    kind: CharacteristicKind
    is_required: bool
    is_visible: bool
    inherited: bool
    source_category_id: int | None
    value: object | None
    default_value: object | None


class VariantCreate(BaseModel):
    article: str = Field(min_length=1, max_length=100)
    name: str = Field(min_length=1, max_length=255)
    option_ids: list[int] = Field(min_length=1)


class VariantUpdate(BaseModel):
    article: str | None = Field(default=None, min_length=1, max_length=100)
    name: str | None = Field(default=None, min_length=1, max_length=255)
    option_ids: list[int] | None = Field(default=None, min_length=1)
    is_active: bool | None = None


class VariantRead(BaseModel):
    id: int
    nomenclature_id: int
    article: str
    name: str
    is_active: bool
    option_ids: list[int]
    options: list[CharacteristicOptionRead]
    created_at: datetime
    updated_at: datetime


class VariantGenerateRequest(BaseModel):
    article_prefix: str = Field(min_length=1, max_length=50)
