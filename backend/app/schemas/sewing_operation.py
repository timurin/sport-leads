from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class SewingOperationBase(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    cost: Decimal = Field(ge=0, max_digits=14, decimal_places=2)
    quantity_per_item: int = Field(default=1, ge=1)
    duration_seconds: int = Field(default=0, ge=0)
    folder_id: int | None = None
    sort_order: int = Field(default=0, ge=0)

    @field_validator("name", mode="before")
    @classmethod
    def strip_name(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value


class SewingOperationCreate(SewingOperationBase):
    work_center_ids: list[int] = Field(default_factory=list)


class SewingOperationUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    cost: Decimal | None = Field(default=None, ge=0, max_digits=14, decimal_places=2)
    quantity_per_item: int | None = Field(default=None, ge=1)
    duration_seconds: int | None = Field(default=None, ge=0)
    folder_id: int | None = None
    sort_order: int | None = Field(default=None, ge=0)
    work_center_ids: list[int] | None = None

    @field_validator("name", mode="before")
    @classmethod
    def strip_name(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value


class SewingOperationRead(SewingOperationBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    work_center_ids: list[int] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime

    @model_validator(mode="before")
    @classmethod
    def extract_work_center_ids(cls, data: object) -> object:
        if hasattr(data, "work_centers"):
            return {
                "id": data.id,
                "name": data.name,
                "cost": data.cost,
                "quantity_per_item": data.quantity_per_item,
                "duration_seconds": data.duration_seconds,
                "folder_id": data.folder_id,
                "sort_order": data.sort_order,
                "work_center_ids": [row.id for row in data.work_centers],
                "created_at": data.created_at,
                "updated_at": data.updated_at,
            }
        return data


class SewingOperationFolderBase(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    parent_id: int | None = None
    sort_order: int = Field(default=0, ge=0)

    @field_validator("name", mode="before")
    @classmethod
    def strip_name(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value


class SewingOperationFolderCreate(SewingOperationFolderBase):
    pass


class SewingOperationFolderUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    parent_id: int | None = None
    sort_order: int | None = Field(default=None, ge=0)

    @field_validator("name", mode="before")
    @classmethod
    def strip_name(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value


class SewingOperationFolderRead(SewingOperationFolderBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    updated_at: datetime


class SewingOperationSiblingMove(BaseModel):
    """Move one step among siblings of the same kind under the same parent."""

    direction: str = Field(pattern="^(up|down)$")
