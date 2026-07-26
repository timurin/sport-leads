"""Shop-floor TechOperation catalog (ADR-017 / Stage 8.1.3).

Distinct from Stage 6 SewingOperation (name + cost).
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    Integer,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base
from app.models.technical_card import TechOperationVolumeUnit


class TechOperation(Base):
    """Flat shop tech-operation with volume unit for TC op-volume prefill."""

    __tablename__ = "tech_operations"
    __table_args__ = (
        UniqueConstraint("name", name="uq_tech_operations_name"),
        UniqueConstraint("code", name="uq_tech_operations_code"),
        CheckConstraint(
            "volume_unit IN ('linear_meters', 'pieces')",
            name="ck_tech_operations_volume_unit",
        ),
        CheckConstraint(
            "sort_order >= 0",
            name="ck_tech_operations_sort_order_nonnegative",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    code: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    volume_unit: Mapped[TechOperationVolumeUnit] = mapped_column(
        String(20),
        nullable=False,
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, index=True
    )
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
