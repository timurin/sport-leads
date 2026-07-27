"""ProductionStage catalog — shop floors / цеха (ADR-017 amend / Stage 8.3)."""

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


class ProductionStage(Base):
    """Shop floor / production stage (цех). Not equipment (WorkCenter)."""

    __tablename__ = "production_stages"
    __table_args__ = (
        UniqueConstraint("name", name="uq_production_stages_name"),
        UniqueConstraint("code", name="uq_production_stages_code"),
        CheckConstraint(
            "sort_order >= 0",
            name="ck_production_stages_sort_order_nonnegative",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    code: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
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
