from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ShopRoutingStageLineBase(BaseModel):
    stage_order: int = Field(ge=1)
    production_stage_id: int = Field(ge=1)
    stage_label: str | None = Field(default=None, max_length=255)
    tech_operation_id: int | None = None
    work_center_id: int | None = None
    is_quality_checkpoint: bool = False

    @field_validator("stage_label", mode="before")
    @classmethod
    def strip_label(cls, value: object) -> object:
        if value is None:
            return None
        if isinstance(value, str):
            stripped = value.strip()
            return stripped or None
        return value


class ShopRoutingStageLineWrite(ShopRoutingStageLineBase):
    pass


class ShopRoutingStageLineRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    routing_template_id: int
    stage_order: int
    production_stage_id: int | None = None
    stage_label: str
    tech_operation_id: int | None = None
    work_center_id: int | None = None
    is_quality_checkpoint: bool = False
    created_at: datetime
    updated_at: datetime


class WorkCenterBase(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    code: str = Field(min_length=1, max_length=64)
    production_stage_id: int | None = None
    is_active: bool = True

    @field_validator("name", "code", mode="before")
    @classmethod
    def strip_text(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value


class WorkCenterCreate(WorkCenterBase):
    pass


class WorkCenterUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    code: str | None = Field(default=None, min_length=1, max_length=64)
    production_stage_id: int | None = None
    is_active: bool | None = None

    @field_validator("name", "code", mode="before")
    @classmethod
    def strip_text(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value


class WorkCenterRead(WorkCenterBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    updated_at: datetime


class ShopRoutingTemplateBase(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    code: str | None = Field(default=None, max_length=64)
    is_active: bool = True
    notes: str | None = None

    @field_validator("name", mode="before")
    @classmethod
    def strip_name(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value

    @field_validator("code", mode="before")
    @classmethod
    def empty_code_to_none(cls, value: object) -> object:
        if value is None:
            return None
        if isinstance(value, str):
            stripped = value.strip()
            return stripped or None
        return value


class ShopRoutingTemplateCreate(ShopRoutingTemplateBase):
    stages: list[ShopRoutingStageLineWrite] = Field(default_factory=list)


class ShopRoutingTemplateUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    code: str | None = Field(default=None, max_length=64)
    is_active: bool | None = None
    notes: str | None = None
    stages: list[ShopRoutingStageLineWrite] | None = None

    @field_validator("name", mode="before")
    @classmethod
    def strip_name(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value

    @field_validator("code", mode="before")
    @classmethod
    def empty_code_to_none(cls, value: object) -> object:
        if isinstance(value, str) and not value.strip():
            return None
        return value.strip() if isinstance(value, str) else value


class ShopRoutingTemplateRead(ShopRoutingTemplateBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    stage_lines: list[ShopRoutingStageLineRead] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime
