from datetime import datetime
from enum import Enum

from pydantic import BaseModel, ConfigDict, Field, field_validator


class TechOperationVolumeUnitSchema(str, Enum):
    LINEAR_METERS = "linear_meters"
    PIECES = "pieces"


class TechOperationBase(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    code: str = Field(min_length=1, max_length=64)
    volume_unit: TechOperationVolumeUnitSchema
    is_active: bool = True
    sort_order: int = Field(default=0, ge=0)

    @field_validator("name", "code", mode="before")
    @classmethod
    def strip_text(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value


class TechOperationCreate(TechOperationBase):
    pass


class TechOperationUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    code: str | None = Field(default=None, min_length=1, max_length=64)
    volume_unit: TechOperationVolumeUnitSchema | None = None
    is_active: bool | None = None
    sort_order: int | None = Field(default=None, ge=0)

    @field_validator("name", "code", mode="before")
    @classmethod
    def strip_text(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value


class TechOperationRead(TechOperationBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    updated_at: datetime
