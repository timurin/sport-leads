"""Pydantic schemas for DesignProject / DesignVersion (ADR-021 / 10.1.1.3)."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


class DesignProjectCreate(BaseModel):
    sales_order_id: int = Field(gt=0)
    title: str | None = Field(default=None, max_length=255)
    notes: str | None = Field(default=None, max_length=4000)

    @field_validator("title", "notes", mode="before")
    @classmethod
    def strip_optional(cls, value: object) -> object:
        if isinstance(value, str):
            trimmed = value.strip()
            return trimmed or None
        return value


class DesignProjectUpdate(BaseModel):
    title: str | None = Field(default=None, max_length=255)
    notes: str | None = Field(default=None, max_length=4000)
    status: str | None = Field(default=None, max_length=20)

    @field_validator("title", "notes", mode="before")
    @classmethod
    def strip_optional(cls, value: object) -> object:
        if isinstance(value, str):
            trimmed = value.strip()
            return trimmed or None
        return value

    @field_validator("status", mode="before")
    @classmethod
    def strip_status(cls, value: object) -> object:
        if isinstance(value, str):
            return value.strip().lower()
        return value


class DesignVersionCreate(BaseModel):
    notes: str | None = Field(default=None, max_length=4000)
    sales_order_item_id: int | None = Field(default=None, gt=0)
    technical_card_id: int | None = Field(default=None, gt=0)
    make_current: bool = False

    @field_validator("notes", mode="before")
    @classmethod
    def strip_notes(cls, value: object) -> object:
        if isinstance(value, str):
            trimmed = value.strip()
            return trimmed or None
        return value


class DesignVersionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    design_project_id: int
    version_no: int
    label: str
    status: str
    notes: str | None = None
    sales_order_item_id: int | None = None
    technical_card_id: int | None = None
    created_at: datetime
    updated_at: datetime


class DesignProjectListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    sales_order_id: int
    sales_order_number: str | None = None
    number: str
    project_seq: int
    status: str
    title: str | None = None
    notes: str | None = None
    version_count: int = 0
    current_version_no: int | None = None
    created_at: datetime
    updated_at: datetime


class DesignProjectRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    sales_order_id: int
    sales_order_number: str | None = None
    number: str
    project_seq: int
    status: str
    title: str | None = None
    notes: str | None = None
    versions: list[DesignVersionRead] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime


class DesignVersionAssetCreate(BaseModel):
    filename: str = Field(min_length=1, max_length=255)
    mime_type: str = Field(min_length=3, max_length=100)
    content_base64: str = Field(min_length=1)
    kind: str = Field(default="layout", max_length=20)
    sort_order: int = Field(default=0, ge=0)
    is_primary: bool = False

    @field_validator("kind", mode="before")
    @classmethod
    def normalize_kind(cls, value: object) -> object:
        if isinstance(value, str):
            return value.strip().lower()
        return value

    @field_validator("filename", mode="before")
    @classmethod
    def strip_filename(cls, value: object) -> object:
        if isinstance(value, str):
            return value.strip()
        return value


class DesignVersionAssetUpdate(BaseModel):
    is_primary: bool | None = None
    sort_order: int | None = Field(default=None, ge=0)
    kind: str | None = Field(default=None, max_length=20)

    @field_validator("kind", mode="before")
    @classmethod
    def normalize_kind(cls, value: object) -> object:
        if isinstance(value, str):
            return value.strip().lower()
        return value


class DesignVersionAssetRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    design_version_id: int
    kind: str
    filename: str
    mime_type: str
    file_size: int
    sort_order: int
    is_primary: bool
    content_url: str
    created_at: datetime
    updated_at: datetime


class DesignVersionCommentCreate(BaseModel):
    body: str = Field(min_length=1, max_length=8000)
    author_name: str | None = Field(default=None, max_length=255)

    @field_validator("body", "author_name", mode="before")
    @classmethod
    def strip_text(cls, value: object) -> object:
        if isinstance(value, str):
            trimmed = value.strip()
            return trimmed or None
        return value


class DesignVersionCommentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    design_version_id: int
    body: str
    author_name: str | None = None
    created_at: datetime
    updated_at: datetime
