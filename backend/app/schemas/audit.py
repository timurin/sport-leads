"""Audit event API schemas (ADR-025 / 17.1.3.2)."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class AuditEventRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    occurred_at: datetime
    actor_platform_user_id: int | None
    actor_login: str | None
    action: str
    entity_type: str
    entity_id: str
    request_id: str | None = None
    payload: dict[str, Any] | None = None
    source: str


class AuditEventListRead(BaseModel):
    items: list[AuditEventRead] = Field(default_factory=list)
