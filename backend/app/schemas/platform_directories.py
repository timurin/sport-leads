"""Platform directories / cities schemas (18.2)."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class PlatformDirectoryRegistryItem(BaseModel):
    code: str
    title: str
    description: str
    list_path: str
    api_prefix: str
    status: str


class PlatformCityRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    region: str | None = None
    is_active: bool
    sort_order: int
    created_at: datetime
    updated_at: datetime


class PlatformCityCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    region: str | None = Field(default=None, max_length=120)
    is_active: bool = True
    sort_order: int = 0


class PlatformCityUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    region: str | None = Field(default=None, max_length=120)
    is_active: bool | None = None
    sort_order: int | None = None
