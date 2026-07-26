from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class VatRateBase(BaseModel):
    name: str = Field(min_length=1, max_length=50)
    rate_percent: Decimal = Field(ge=0, le=100, max_digits=5, decimal_places=2)
    is_active: bool = True
    sort_order: int = Field(default=0, ge=0)

    @field_validator("name", mode="before")
    @classmethod
    def strip_name(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value


class VatRateCreate(VatRateBase):
    pass


class VatRateUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=50)
    rate_percent: Decimal | None = Field(default=None, ge=0, le=100, max_digits=5, decimal_places=2)
    is_active: bool | None = None
    sort_order: int | None = Field(default=None, ge=0)

    @field_validator("name", mode="before")
    @classmethod
    def strip_name(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value


class VatRateRead(VatRateBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    updated_at: datetime
