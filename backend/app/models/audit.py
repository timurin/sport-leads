"""Universal platform audit events (ADR-025 / 17.1.3)."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import JSON

from app.database.base import Base

# JSONB on Postgres; plain JSON elsewhere (sqlite tests).
_JSON = JSON().with_variant(JSONB(), "postgresql")


class AuditEvent(Base):
    """Append-only platform audit row (ADR-025)."""

    __tablename__ = "audit_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    occurred_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        index=True,
    )
    actor_platform_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("platform_users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    actor_login: Mapped[str | None] = mapped_column(String(64), nullable=True)
    action: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    entity_type: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    entity_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    request_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    payload: Mapped[dict[str, Any] | None] = mapped_column(_JSON, nullable=True)
    source: Mapped[str] = mapped_column(
        String(32), nullable=False, default="api", server_default="api"
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
