from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ClientFolderBase(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    parent_id: int | None = None
    sort_order: int = Field(default=0, ge=0)

    @field_validator("name", mode="before")
    @classmethod
    def strip_name(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value


class ClientFolderCreate(ClientFolderBase):
    pass


class ClientFolderUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    parent_id: int | None = None
    sort_order: int | None = Field(default=None, ge=0)

    @field_validator("name", mode="before")
    @classmethod
    def strip_name(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value


class ClientFolderRead(ClientFolderBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    updated_at: datetime


class ClientFolderSiblingMove(BaseModel):
    direction: str = Field(pattern="^(up|down)$")


class ClientFolderAssign(BaseModel):
    folder_id: int | None
