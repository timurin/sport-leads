from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


class CharacteristicDefinitionCreate(BaseModel):
    code: str = Field(min_length=1, max_length=100, pattern=r"^[a-z0-9][a-z0-9_-]*$")
    name: str = Field(min_length=1, max_length=255)

    @field_validator("code", "name")
    @classmethod
    def strip_text(cls, value: str) -> str:
        return value.strip()


class CharacteristicDefinitionUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    is_active: bool | None = None


class CharacteristicDefinitionRead(CharacteristicDefinitionCreate):
    model_config = ConfigDict(from_attributes=True)
    id: int
    is_active: bool
    created_at: datetime
    updated_at: datetime


class CharacteristicOptionCreate(BaseModel):
    code: str = Field(min_length=1, max_length=100, pattern=r"^[a-z0-9][a-z0-9_-]*$")
    label: str = Field(min_length=1, max_length=255)
    sort_order: int = Field(default=0, ge=0)


class CharacteristicOptionUpdate(BaseModel):
    label: str | None = Field(default=None, min_length=1, max_length=255)
    sort_order: int | None = Field(default=None, ge=0)
    is_active: bool | None = None


class CharacteristicOptionRead(CharacteristicOptionCreate):
    model_config = ConfigDict(from_attributes=True)
    id: int
    characteristic_id: int
    is_active: bool
    created_at: datetime
    updated_at: datetime


class CategoryCharacteristicCreate(BaseModel):
    characteristic_id: int
    is_required: bool = False
    inherit: bool = True
    sort_order: int = Field(default=0, ge=0)


class CategoryCharacteristicRead(CategoryCharacteristicCreate):
    model_config = ConfigDict(from_attributes=True)
    id: int
    category_id: int
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
