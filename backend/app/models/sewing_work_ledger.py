"""Sewing work ledger — multi-sewer reserve/complete/release (ADR-029 / Stage 24)."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from enum import Enum
from typing import TYPE_CHECKING

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base

if TYPE_CHECKING:
    from app.models.auth import PlatformUser
    from app.models.technical_card import TechnicalCard, TechnicalCardOperationLine


class SewingWorkKind(str, Enum):
    PIECE = "piece"
    OPERATION = "operation"


class SewingWorkStatus(str, Enum):
    RESERVED = "reserved"
    COMPLETED = "completed"
    RELEASED = "released"


class SewingWorkLedgerEntry(Base):
    """One take of pieces or a sewing operation line; no DELETE (ADR-029)."""

    __tablename__ = "sewing_work_ledger_entries"
    __table_args__ = (
        CheckConstraint(
            "kind IN ('piece', 'operation')",
            name="ck_swle_kind",
        ),
        CheckConstraint(
            "status IN ('reserved', 'completed', 'released')",
            name="ck_swle_status",
        ),
        CheckConstraint("qty > 0", name="ck_swle_qty_positive"),
        CheckConstraint("unit_price >= 0", name="ck_swle_unit_price_non_negative"),
        CheckConstraint(
            "(kind = 'piece' AND operation_line_id IS NULL) OR "
            "(kind = 'operation' AND operation_line_id IS NOT NULL)",
            name="ck_swle_kind_operation_line",
        ),
        CheckConstraint(
            "(status = 'reserved' AND completed_at IS NULL AND released_at IS NULL) OR "
            "(status = 'completed' AND completed_at IS NOT NULL AND released_at IS NULL) OR "
            "(status = 'released' AND released_at IS NOT NULL AND completed_at IS NULL)",
            name="ck_swle_status_timestamps",
        ),
        Index("ix_swle_platform_user_id", "platform_user_id"),
        Index("ix_swle_technical_card_id", "technical_card_id"),
        Index("ix_swle_user_status", "platform_user_id", "status"),
        Index("ix_swle_card_kind_status", "technical_card_id", "kind", "status"),
        Index("ix_swle_operation_line_id", "operation_line_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    platform_user_id: Mapped[int] = mapped_column(
        ForeignKey("platform_users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    technical_card_id: Mapped[int] = mapped_column(
        ForeignKey("technical_cards.id", ondelete="RESTRICT"),
        nullable=False,
    )
    kind: Mapped[SewingWorkKind] = mapped_column(String(20), nullable=False)
    operation_line_id: Mapped[int | None] = mapped_column(
        ForeignKey("technical_card_operation_lines.id", ondelete="RESTRICT"),
        nullable=True,
    )
    qty: Mapped[Decimal] = mapped_column(Numeric(14, 3), nullable=False)
    status: Mapped[SewingWorkStatus] = mapped_column(String(20), nullable=False)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    price_label: Mapped[str] = mapped_column(String(255), nullable=False)
    taken_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    released_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
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

    platform_user: Mapped[PlatformUser] = relationship()
    technical_card: Mapped[TechnicalCard] = relationship()
    operation_line: Mapped[TechnicalCardOperationLine | None] = relationship()
