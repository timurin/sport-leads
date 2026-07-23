from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from sqlalchemy import CheckConstraint, DateTime, Integer, Numeric, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base


class SewingOperation(Base):
    """Flat sewing-operation catalog (name + cost + duration). Replaces PatternSet in Stage 6.3."""

    __tablename__ = "sewing_operations"
    __table_args__ = (
        UniqueConstraint("name", name="uq_sewing_operations_name"),
        CheckConstraint("cost >= 0", name="ck_sewing_operations_cost_non_negative"),
        CheckConstraint(
            "duration_seconds >= 0",
            name="ck_sewing_operations_duration_seconds_non_negative",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    cost: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    duration_seconds: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
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
