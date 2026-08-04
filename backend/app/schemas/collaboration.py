"""Schemas for internal collaboration (ADR-026 / Stage 19)."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


class CollaborationMentionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    mentioned_platform_user_id: int
    mentioned_login_snapshot: str
    created_at: datetime


class CollaborationMessageCreate(BaseModel):
    body: str = Field(min_length=1, max_length=8000)
    technical_card_id: int | None = Field(default=None, ge=1)

    @field_validator("body", mode="before")
    @classmethod
    def strip_body(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value


class CollaborationMessageRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    thread_id: int
    sales_order_id: int
    author_platform_user_id: int
    author_login: str
    author_display_name: str
    body: str
    technical_card_id: int | None = None
    created_at: datetime
    updated_at: datetime
    mentions: list[CollaborationMentionRead] = Field(default_factory=list)


class CollaborationMicrotaskCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    assignee_platform_user_id: int = Field(ge=1)
    technical_card_id: int | None = Field(default=None, ge=1)
    source_message_id: int | None = Field(default=None, ge=1)

    @field_validator("title", mode="before")
    @classmethod
    def strip_title(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value


class CollaborationMicrotaskStatusUpdate(BaseModel):
    status: str = Field(pattern=r"^(open|done)$")


class CollaborationMicrotaskRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    sales_order_id: int
    title: str
    status: str
    assignee_platform_user_id: int
    assignee_login: str
    assignee_display_name: str
    created_by_platform_user_id: int
    created_by_login: str
    created_by_display_name: str
    technical_card_id: int | None = None
    source_message_id: int | None = None
    created_at: datetime
    updated_at: datetime
    completed_at: datetime | None = None


class CollaborationMentionCandidateRead(BaseModel):
    id: int
    login: str
    display_name: str


class CollaborationNotificationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    kind: str
    title: str
    body: str
    sales_order_id: int
    technical_card_id: int | None = None
    source_message_id: int | None = None
    microtask_id: int | None = None
    actor_platform_user_id: int | None = None
    created_at: datetime
    read_at: datetime | None = None
    deep_link: str


class CollaborationNotificationListRead(BaseModel):
    items: list[CollaborationNotificationRead]
    unread_count: int


MICROTASK_TITLE_TEMPLATES: list[str] = [
    "Правка по макету",
    "Не хватает материала",
]
