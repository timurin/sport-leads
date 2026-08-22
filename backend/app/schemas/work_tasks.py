"""Schemas for unified Work Tasks (ADR-028 / Stage 23)."""

from __future__ import annotations

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

WorkTaskStatusLiteral = Literal["open", "in_progress", "done", "cancelled"]


class WorkTaskSalesOrderSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    number: str
    client_company_name: str | None = None
    status: str
    amount: str | None = None
    currency_code: str
    desired_date: date | None = None


class WorkTaskCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    status: WorkTaskStatusLiteral = "open"
    production_stage_id: int | None = Field(default=None, ge=1)
    board_stage_id: int | None = Field(default=None, ge=1)
    responsible_platform_user_id: int | None = Field(default=None, ge=1)
    executor_platform_user_id: int | None = Field(default=None, ge=1)
    lead_id: int | None = Field(default=None, ge=1)
    sales_order_id: int | None = Field(default=None, ge=1)
    production_order_id: int | None = Field(default=None, ge=1)
    due_at: datetime | None = None

    @field_validator("title", mode="before")
    @classmethod
    def strip_title(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value

    @model_validator(mode="after")
    def exactly_one_anchor(self) -> WorkTaskCreate:
        anchors = [
            self.lead_id is not None,
            self.sales_order_id is not None,
            self.production_order_id is not None,
        ]
        if sum(anchors) != 1:
            raise ValueError(
                "Exactly one of lead_id, sales_order_id, production_order_id is required"
            )
        return self


class WorkTaskUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    status: WorkTaskStatusLiteral | None = None
    production_stage_id: int | None = Field(default=None, ge=1)
    board_stage_id: int | None = None
    responsible_platform_user_id: int | None = Field(default=None, ge=1)
    executor_platform_user_id: int | None = Field(default=None, ge=1)
    due_at: datetime | None = None

    @field_validator("title", mode="before")
    @classmethod
    def strip_title(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value

    @field_validator("board_stage_id", mode="after")
    @classmethod
    def board_stage_positive(cls, value: int | None) -> int | None:
        if value is not None and value < 1:
            raise ValueError("board_stage_id must be >= 1")
        return value


class WorkTaskListItem(BaseModel):
    """Slim list DTO (SL-LIST-PAGE-RULES-v1): scalars + display embeds, no messages."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    status: str
    production_stage_id: int | None
    production_stage_name: str | None = None
    board_stage_id: int | None = None
    board_stage_name: str | None = None
    created_by_platform_user_id: int | None = None
    created_by_display_name: str | None = None
    responsible_platform_user_id: int | None
    responsible_display_name: str | None = None
    executor_platform_user_id: int | None
    executor_display_name: str | None = None
    lead_id: int | None
    sales_order_id: int | None
    production_order_id: int | None
    due_at: datetime | None
    created_at: datetime
    updated_at: datetime


class WorkTaskRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    status: str
    production_stage_id: int | None
    production_stage_name: str | None = None
    board_stage_id: int | None = None
    board_stage_name: str | None = None
    created_by_platform_user_id: int | None = None
    created_by_display_name: str | None = None
    responsible_platform_user_id: int | None
    responsible_display_name: str | None = None
    executor_platform_user_id: int | None
    executor_display_name: str | None = None
    lead_id: int | None
    sales_order_id: int | None
    sales_order_summary: WorkTaskSalesOrderSummary | None = None
    production_order_id: int | None
    due_at: datetime | None
    created_at: datetime
    updated_at: datetime
    completed_at: datetime | None


class WorkTaskBoardStageRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    sort_order: int
    is_active: bool
    created_at: datetime
    updated_at: datetime


class WorkTaskBoardStageCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    sort_order: int | None = Field(default=None, ge=0)

    @field_validator("name", mode="before")
    @classmethod
    def strip_name(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value


class WorkTaskBoardStageUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    sort_order: int | None = Field(default=None, ge=0)
    is_active: bool | None = None

    @field_validator("name", mode="before")
    @classmethod
    def strip_name(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value


class WorkTaskAttachmentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    message_id: int
    mime_type: str
    size_bytes: int
    original_filename: str
    created_at: datetime


class WorkTaskMessageRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    work_task_id: int
    author_platform_user_id: int
    author_display_name: str | None = None
    body: str
    created_at: datetime
    attachments: list[WorkTaskAttachmentRead] = Field(default_factory=list)
