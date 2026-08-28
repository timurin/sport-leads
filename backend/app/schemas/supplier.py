from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, field_validator


def _blank_to_none(value: object) -> object:
    if isinstance(value, str):
        stripped = value.strip()
        return stripped or None
    return value


class SupplierListItem(BaseModel):
    """Slim list DTO — no prices array (SL-LIST-PAGE-RULES-v1)."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    code: str | None
    inn: str | None
    phone: str | None
    email: str | None
    is_active: bool
    created_at: datetime
    updated_at: datetime


class SupplierPriceRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    supplier_id: int
    nomenclature_id: int
    nomenclature_name: str
    unit_price: Decimal
    currency: str
    comment: str | None
    created_at: datetime
    updated_at: datetime


class SupplierDetailRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    code: str | None
    inn: str | None
    kpp: str | None
    phone: str | None
    email: str | None
    legal_address: str | None
    notes: str | None
    is_active: bool
    created_at: datetime
    updated_at: datetime
    prices: list[SupplierPriceRead] = []


class SupplierCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    code: str | None = Field(default=None, max_length=50)
    inn: str | None = Field(default=None, max_length=12, pattern=r"^(\d{10}|\d{12})$")
    kpp: str | None = Field(default=None, max_length=9, pattern=r"^\d{9}$")
    phone: str | None = Field(default=None, max_length=50)
    email: str | None = Field(default=None, max_length=255)
    legal_address: str | None = Field(default=None, max_length=500)
    notes: str | None = None
    is_active: bool = True

    @field_validator("name", mode="before")
    @classmethod
    def strip_name(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value

    @field_validator(
        "code",
        "inn",
        "kpp",
        "phone",
        "email",
        "legal_address",
        "notes",
        mode="before",
    )
    @classmethod
    def blank_to_none(cls, value: object) -> object:
        return _blank_to_none(value)


class SupplierUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    code: str | None = Field(default=None, max_length=50)
    inn: str | None = Field(default=None, max_length=12, pattern=r"^(\d{10}|\d{12})$")
    kpp: str | None = Field(default=None, max_length=9, pattern=r"^\d{9}$")
    phone: str | None = Field(default=None, max_length=50)
    email: str | None = Field(default=None, max_length=255)
    legal_address: str | None = Field(default=None, max_length=500)
    notes: str | None = None
    is_active: bool | None = None

    @field_validator("name", mode="before")
    @classmethod
    def strip_name(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value

    @field_validator(
        "code",
        "inn",
        "kpp",
        "phone",
        "email",
        "legal_address",
        "notes",
        mode="before",
    )
    @classmethod
    def blank_to_none(cls, value: object) -> object:
        return _blank_to_none(value)


class SupplierPriceCreate(BaseModel):
    nomenclature_id: int = Field(gt=0)
    unit_price: Decimal = Field(gt=0, max_digits=14, decimal_places=2)
    currency: str = Field(default="RUB", min_length=3, max_length=3)
    comment: str | None = Field(default=None, max_length=255)

    @field_validator("currency", mode="before")
    @classmethod
    def normalize_currency(cls, value: object) -> object:
        if isinstance(value, str):
            return value.strip().upper() or "RUB"
        return value

    @field_validator("comment", mode="before")
    @classmethod
    def blank_comment(cls, value: object) -> object:
        return _blank_to_none(value)


class SupplierPriceUpdate(BaseModel):
    unit_price: Decimal | None = Field(default=None, gt=0, max_digits=14, decimal_places=2)
    currency: str | None = Field(default=None, min_length=3, max_length=3)
    comment: str | None = Field(default=None, max_length=255)

    @field_validator("currency", mode="before")
    @classmethod
    def normalize_currency(cls, value: object) -> object:
        if isinstance(value, str):
            stripped = value.strip().upper()
            return stripped or None
        return value

    @field_validator("comment", mode="before")
    @classmethod
    def blank_comment(cls, value: object) -> object:
        return _blank_to_none(value)
