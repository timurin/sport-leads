from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, CheckConstraint, DateTime, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base


class TechnicalCardSettings(Base):
    """Singleton settings row for Stage 9.6 technical-card defaults."""

    __tablename__ = "technical_card_settings"
    __table_args__ = (
        CheckConstraint("id = 1", name="ck_technical_card_settings_singleton_id"),
        CheckConstraint(
            "stage_label_binding_mode IN ('snapshot')",
            name="ck_technical_card_settings_stage_label_binding_mode",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    eligible_nomenclature_types: Mapped[str] = mapped_column(
        String(120), nullable=False, default="PRODUCT"
    )
    numbering_template: Mapped[str] = mapped_column(
        String(120), nullable=False, default="{orderNo}-{cardSeq}"
    )
    unit_field_size_type_enabled: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True
    )
    unit_field_size_enabled: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True
    )
    unit_field_personalization_enabled: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True
    )
    unit_field_print_number_enabled: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True
    )
    unit_field_notes_enabled: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True
    )
    stage_label_binding_mode: Mapped[str] = mapped_column(
        String(30), nullable=False, default="snapshot"
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
