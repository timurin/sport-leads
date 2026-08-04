"""Platform system settings schemas (18.1.2)."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class PlatformSystemSettingsRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    organization_display_name: str
    default_timezone: str
    support_email: str | None = None
    ui_locale: str
    notes: str | None = None
    logo_url: str | None = None
    logo_filename: str | None = None
    created_at: datetime
    updated_at: datetime


class PlatformSystemSettingsUpdate(BaseModel):
    organization_display_name: str = Field(min_length=1, max_length=255)
    default_timezone: str = Field(min_length=1, max_length=64)
    support_email: str | None = Field(default=None, max_length=255)
    ui_locale: str = Field(min_length=2, max_length=16)
    notes: str | None = None


class PlatformBrandRead(BaseModel):
    """Shell brand subset (sidebar header)."""

    organization_display_name: str
    logo_url: str | None = None
