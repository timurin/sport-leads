from datetime import datetime
from decimal import Decimal
from enum import Enum

from pydantic import BaseModel, ConfigDict, Field, field_validator


class TechOperationVolumeUnitSchema(str, Enum):
    LINEAR_METERS = "linear_meters"
    PIECES = "pieces"


class TechOperationRequiredMaterialBase(BaseModel):
    nomenclature_id: int = Field(ge=1)
    quantity: Decimal = Field(ge=0, max_digits=14, decimal_places=3)


class TechOperationRequiredMaterialWrite(TechOperationRequiredMaterialBase):
    pass


class TechOperationRequiredMaterialRead(TechOperationRequiredMaterialBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    tech_operation_id: int
    nomenclature_name: str | None = None
    unit: str | None = None
    created_at: datetime
    updated_at: datetime


class TechOperationBase(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    code: str = Field(min_length=1, max_length=64)
    volume_unit: TechOperationVolumeUnitSchema
    production_stage_id: int | None = None
    is_active: bool = True
    sort_order: int = Field(default=0, ge=0)
    required_materials: list[TechOperationRequiredMaterialWrite] = Field(default_factory=list)

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
    production_stage_id: int | None = None
    is_active: bool | None = None
    sort_order: int | None = Field(default=None, ge=0)
    required_materials: list[TechOperationRequiredMaterialWrite] | None = None

    @field_validator("name", "code", mode="before")
    @classmethod
    def strip_text(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value


class TechOperationRead(TechOperationBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    required_materials: list[TechOperationRequiredMaterialRead] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime
