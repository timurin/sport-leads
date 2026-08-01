from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import (
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Table,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base

if TYPE_CHECKING:
    from app.models.shop_routing import WorkCenter

sewing_operation_work_centers = Table(
    "sewing_operation_work_centers",
    Base.metadata,
    Column(
        "sewing_operation_id",
        ForeignKey("sewing_operations.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "work_center_id",
        ForeignKey("work_centers.id", ondelete="CASCADE"),
        primary_key=True,
    ),
)


class SewingOperation(Base):
    """Flat sewing-operation catalog (name + cost + qty + duration). Replaces PatternSet in Stage 6.3."""

    __tablename__ = "sewing_operations"
    __table_args__ = (
        UniqueConstraint("name", name="uq_sewing_operations_name"),
        CheckConstraint("cost >= 0", name="ck_sewing_operations_cost_non_negative"),
        CheckConstraint(
            "quantity_per_item >= 1",
            name="ck_sewing_operations_quantity_per_item_positive",
        ),
        CheckConstraint(
            "duration_seconds >= 0",
            name="ck_sewing_operations_duration_seconds_non_negative",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    cost: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    quantity_per_item: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
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

    work_centers: Mapped[list[WorkCenter]] = relationship(
        "WorkCenter",
        secondary=sewing_operation_work_centers,
        lazy="selectin",
    )
