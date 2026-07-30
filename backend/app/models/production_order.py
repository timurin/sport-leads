"""ProductionOrder + ProductionBatch persistence (ADR-018 / Stage 11.1.1.2)."""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING

from sqlalchemy import (
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base

if TYPE_CHECKING:
    from app.models.sales import SalesOrder
    from app.models.technical_card import TechnicalCard


class ProductionOrderStatus(str, Enum):
    DRAFT = "draft"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class ProductionBatchStatus(str, Enum):
    DRAFT = "draft"
    RELEASED = "released"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class ProductionOrder(Base):
    """Planning document under Production, linked to one SalesOrder (ADR-018)."""

    __tablename__ = "production_orders"
    __table_args__ = (
        UniqueConstraint(
            "sales_order_id",
            "order_seq",
            name="uq_production_orders_sales_order_seq",
        ),
        UniqueConstraint("number", name="uq_production_orders_number"),
        Index("ix_production_orders_sales_order_id", "sales_order_id"),
        Index("ix_production_orders_status", "status"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    sales_order_id: Mapped[int] = mapped_column(
        ForeignKey("sales_orders.id", ondelete="RESTRICT"),
        nullable=False,
    )
    number: Mapped[str] = mapped_column(String(80), nullable=False)
    order_seq: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default=ProductionOrderStatus.DRAFT.value,
        server_default=ProductionOrderStatus.DRAFT.value,
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
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

    sales_order: Mapped[SalesOrder] = relationship("SalesOrder")
    batches: Mapped[list[ProductionBatch]] = relationship(
        "ProductionBatch",
        back_populates="production_order",
        cascade="all, delete-orphan",
        order_by="ProductionBatch.batch_seq",
    )


class ProductionBatch(Base):
    """Release batch grouping technical cards under a ProductionOrder (ADR-018)."""

    __tablename__ = "production_batches"
    __table_args__ = (
        UniqueConstraint(
            "production_order_id",
            "batch_seq",
            name="uq_production_batches_order_batch_seq",
        ),
        UniqueConstraint("number", name="uq_production_batches_number"),
        Index("ix_production_batches_production_order_id", "production_order_id"),
        Index("ix_production_batches_status", "status"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    production_order_id: Mapped[int] = mapped_column(
        ForeignKey("production_orders.id", ondelete="CASCADE"),
        nullable=False,
    )
    number: Mapped[str] = mapped_column(String(100), nullable=False)
    batch_seq: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default=ProductionBatchStatus.DRAFT.value,
        server_default=ProductionBatchStatus.DRAFT.value,
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
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

    production_order: Mapped[ProductionOrder] = relationship(
        "ProductionOrder",
        back_populates="batches",
    )
    card_links: Mapped[list[ProductionBatchCardLink]] = relationship(
        "ProductionBatchCardLink",
        back_populates="batch",
        cascade="all, delete-orphan",
    )


class ProductionBatchCardLink(Base):
    """MVP: a TechnicalCard belongs to at most one batch (ADR-018)."""

    __tablename__ = "production_batch_card_links"
    __table_args__ = (
        UniqueConstraint(
            "technical_card_id",
            name="uq_production_batch_card_links_technical_card_id",
        ),
        UniqueConstraint(
            "production_batch_id",
            "technical_card_id",
            name="uq_production_batch_card_links_batch_card",
        ),
        Index("ix_production_batch_card_links_batch_id", "production_batch_id"),
        Index("ix_production_batch_card_links_card_id", "technical_card_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    production_batch_id: Mapped[int] = mapped_column(
        ForeignKey("production_batches.id", ondelete="CASCADE"),
        nullable=False,
    )
    technical_card_id: Mapped[int] = mapped_column(
        ForeignKey("technical_cards.id", ondelete="RESTRICT"),
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    batch: Mapped[ProductionBatch] = relationship(
        "ProductionBatch",
        back_populates="card_links",
    )
    technical_card: Mapped[TechnicalCard] = relationship("TechnicalCard")
