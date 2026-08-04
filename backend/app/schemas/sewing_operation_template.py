from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


class SewingOperationTemplateLineRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    sewing_operation_id: int
    sequence: int
    operation_name: str | None = None
    cost: str | None = None
    quantity_per_item: int | None = None
    duration_seconds: int | None = None


class SewingOperationTemplateBase(BaseModel):
    name: str = Field(min_length=1, max_length=255)

    @field_validator("name", mode="before")
    @classmethod
    def strip_name(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value


class SewingOperationTemplateCreate(SewingOperationTemplateBase):
    sewing_operation_ids: list[int] = Field(default_factory=list)


class SewingOperationTemplateUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    sewing_operation_ids: list[int] | None = None

    @field_validator("name", mode="before")
    @classmethod
    def strip_name(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value


class SewingOperationTemplateRead(SewingOperationTemplateBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    lines: list[SewingOperationTemplateLineRead] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime


class SewingOperationTemplateReplaceLines(BaseModel):
    sewing_operation_ids: list[int] = Field(default_factory=list)
