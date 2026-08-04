"""Print-form registry schemas (18.3.2)."""

from __future__ import annotations

from typing import Any
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class PrintFormVersionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    print_form_id: int
    version_no: int
    template_label: str
    storage_kind: str
    template_source: str
    status: str
    is_current: bool
    created_at: datetime
    updated_at: datetime


class PrintFormRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    code: str
    title: str
    description: str | None = None
    binding_type: str
    binding_key: str
    status: str
    output_format: str
    versioning_mode: str
    created_at: datetime
    updated_at: datetime
    versions: list[PrintFormVersionRead] = []


class PrintFormCreate(BaseModel):
    code: str = Field(min_length=1, max_length=80)
    title: str = Field(min_length=1, max_length=160)
    description: str | None = None
    binding_type: str = Field(min_length=1, max_length=20)
    binding_key: str = Field(min_length=1, max_length=120)
    status: str = Field(default="draft", min_length=1, max_length=20)
    output_format: str = Field(default="html", min_length=1, max_length=20)
    versioning_mode: str = Field(
        default="single_active",
        min_length=1,
        max_length=20,
    )


class PrintFormUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=160)
    description: str | None = None
    binding_type: str | None = Field(default=None, min_length=1, max_length=20)
    binding_key: str | None = Field(default=None, min_length=1, max_length=120)
    status: str | None = Field(default=None, min_length=1, max_length=20)
    output_format: str | None = Field(default=None, min_length=1, max_length=20)
    versioning_mode: str | None = Field(default=None, min_length=1, max_length=20)


class PrintFormVersionCreate(BaseModel):
    template_label: str = Field(min_length=1, max_length=160)
    storage_kind: str = Field(default="inline_text", min_length=1, max_length=20)
    template_source: str = Field(min_length=1)
    status: str = Field(default="draft", min_length=1, max_length=20)
    is_current: bool = False


class PrintFormVersionUpdate(BaseModel):
    template_label: str | None = Field(default=None, min_length=1, max_length=160)
    storage_kind: str | None = Field(default=None, min_length=1, max_length=20)
    template_source: str | None = Field(default=None, min_length=1)
    status: str | None = Field(default=None, min_length=1, max_length=20)
    is_current: bool | None = None


class PrintFormVersionPublishRequest(BaseModel):
    is_current: bool = True


class PrintFormPreviewRequest(BaseModel):
    version_id: int | None = None
    payload: dict[str, Any] = Field(default_factory=dict)


class PrintFormGenerateRequest(BaseModel):
    binding_type: str = Field(min_length=1, max_length=20)
    binding_key: str = Field(min_length=1, max_length=120)
    output_format: str = Field(default="html", min_length=1, max_length=20)
    payload: dict[str, Any] = Field(default_factory=dict)


class PrintFormRenderRead(BaseModel):
    print_form_id: int
    print_form_code: str
    version_id: int
    version_no: int
    output_format: str
    content_type: str
    file_name: str
    content: str
    content_encoding: str = "text"
    is_preview: bool
