"""Platform system settings singleton (Stage 18.1.2)."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base


class PlatformSystemSettings(Base):
    """Singleton row for platform-level Administration parameters."""

    __tablename__ = "platform_system_settings"
    __table_args__ = (
        CheckConstraint("id = 1", name="ck_platform_system_settings_singleton_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    organization_display_name: Mapped[str] = mapped_column(
        String(255), nullable=False, default="Sport-Lead"
    )
    default_timezone: Mapped[str] = mapped_column(
        String(64), nullable=False, default="Europe/Moscow"
    )
    support_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    ui_locale: Mapped[str] = mapped_column(String(16), nullable=False, default="ru-RU")
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    logo_storage_key: Mapped[str | None] = mapped_column(String(512), nullable=True)
    logo_mime_type: Mapped[str | None] = mapped_column(String(128), nullable=True)
    logo_original_filename: Mapped[str | None] = mapped_column(
        String(255), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
