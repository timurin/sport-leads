from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.nomenclature import NomenclatureType, UnitCategory


class UnitOfMeasureBase(BaseModel):
    code: str = Field(min_length=1, max_length=30, pattern=r"^[A-Z0-9][A-Z0-9_-]*$")
    name: str = Field(min_length=1, max_length=100)
    symbol: str = Field(min_length=1, max_length=20)
    unit_category: UnitCategory
    precision: int = Field(default=0, ge=0, le=6)
    is_active: bool = True

    @field_validator("code", "name", "symbol", mode="before")
    @classmethod
    def strip_unit_text(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value


class UnitOfMeasureCreate(UnitOfMeasureBase):
    pass


class UnitOfMeasureUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    symbol: str | None = Field(default=None, min_length=1, max_length=20)
    unit_category: UnitCategory | None = None
    precision: int | None = Field(default=None, ge=0, le=6)
    is_active: bool | None = None

    @field_validator("name", "symbol", mode="before")
    @classmethod
    def strip_optional_unit_text(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value


class UnitOfMeasureRead(UnitOfMeasureBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    is_system: bool
    created_at: datetime
    updated_at: datetime


class NomenclatureCategoryBase(BaseModel):
    parent_id: int | None = None
    name: str = Field(min_length=1, max_length=255)
    code: str = Field(min_length=1, max_length=100, pattern=r"^[a-z0-9][a-z0-9_-]*$")
    description: str | None = None
    nomenclature_type: NomenclatureType = NomenclatureType.PRODUCT
    is_active: bool = True
    sort_order: int = Field(default=0, ge=0)

    @field_validator("name", "code", mode="before")
    @classmethod
    def strip_required_text(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value


class NomenclatureCategoryCreate(NomenclatureCategoryBase):
    pass


class NomenclatureCategoryUpdate(BaseModel):
    parent_id: int | None = None
    name: str | None = Field(default=None, min_length=1, max_length=255)
    code: str | None = Field(default=None, min_length=1, max_length=100, pattern=r"^[a-z0-9][a-z0-9_-]*$")
    description: str | None = None
    nomenclature_type: NomenclatureType | None = None
    is_active: bool | None = None
    sort_order: int | None = Field(default=None, ge=0)

    @field_validator("name", "code", mode="before")
    @classmethod
    def strip_optional_text(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value


class NomenclatureCategoryRead(NomenclatureCategoryBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    updated_at: datetime


class NomenclatureBase(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    short_name: str | None = Field(default=None, max_length=100)
    description: str | None = None
    category: str = Field(min_length=1, max_length=100)
    category_id: int | None = None
    storage_unit_id: int | None = None
    nomenclature_type: NomenclatureType = NomenclatureType.PRODUCT
    product_type_id: int | None = None
    unit: str = Field(default="шт", min_length=1, max_length=30)
    base_price: Decimal = Field(default=Decimal("0"), ge=0, max_digits=14, decimal_places=2)
    currency: str = Field(default="RUB", min_length=3, max_length=3, pattern=r"^[A-Z]{3}$")
    is_active: bool = True

    @field_validator("name", "short_name", "category", "unit", "currency", mode="before")
    @classmethod
    def strip_text(cls, value: object) -> object:
        if isinstance(value, str):
            return value.strip() or None
        return value


class NomenclatureCreate(NomenclatureBase):
    pass


class NomenclatureUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    short_name: str | None = Field(default=None, max_length=100)
    description: str | None = None
    category: str | None = Field(default=None, min_length=1, max_length=100)
    category_id: int | None = None
    storage_unit_id: int | None = None
    nomenclature_type: NomenclatureType | None = None
    product_type_id: int | None = None
    unit: str | None = Field(default=None, min_length=1, max_length=30)
    base_price: Decimal | None = Field(default=None, ge=0, max_digits=14, decimal_places=2)
    currency: str | None = Field(default=None, min_length=3, max_length=3, pattern=r"^[A-Z]{3}$")
    is_active: bool | None = None

    @field_validator("name", "short_name", "category", "unit", "currency", mode="before")
    @classmethod
    def strip_text(cls, value: object) -> object:
        if isinstance(value, str):
            return value.strip() or None
        return value


class NomenclatureRead(NomenclatureBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    product_type_name: str | None = None
    created_at: datetime
    updated_at: datetime
