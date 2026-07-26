from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from sqlalchemy import Boolean, CheckConstraint, DateTime, Integer, Numeric, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base


class VatRate(Base):
    """VAT rate directory (Ставки НДС). Seeded 0% / 5% / 22%."""

    __tablename__ = "vat_rates"
    __table_args__ = (
        UniqueConstraint("rate_percent", name="uq_vat_rates_rate_percent"),
        UniqueConstraint("name", name="uq_vat_rates_name"),
        CheckConstraint(
            "rate_percent >= 0 AND rate_percent <= 100",
            name="ck_vat_rates_rate_percent_range",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(50), nullable=False)
    rate_percent: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
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
