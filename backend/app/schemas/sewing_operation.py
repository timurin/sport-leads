from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class SewingOperationBase(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    cost: Decimal = Field(ge=0, max_digits=14, decimal_places=2)
    duration_seconds: int = Field(default=0, ge=0)

    @field_validator("name", mode="before")
    @classmethod
    def strip_name(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value


class SewingOperationCreate(SewingOperationBase):
    pass


class SewingOperationUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    cost: Decimal | None = Field(default=None, ge=0, max_digits=14, decimal_places=2)
    duration_seconds: int | None = Field(default=None, ge=0)

    @field_validator("name", mode="before")
    @classmethod
    def strip_name(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value


class SewingOperationRead(SewingOperationBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    updated_at: datetime
