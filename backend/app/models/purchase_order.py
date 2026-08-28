"""Purchase orders (Stage 13.1.2 / ADR-034)."""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from enum import Enum

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base


class PurchaseOrderStatus(str, Enum):
    DRAFT = "draft"
    ORDERED = "ordered"
    CANCELLED = "cancelled"


class PurchaseOrder(Base):
    """Заказ поставщику. Draft = internal request; confirm does not post stock."""

    __tablename__ = "purchase_orders"
    __table_args__ = (
        UniqueConstraint("number", name="uq_purchase_orders_number"),
        CheckConstraint(
            "status IN ('draft', 'ordered', 'cancelled')",
            name="ck_purchase_orders_status",
        ),
        CheckConstraint(
            "currency = 'RUB'",
            name="ck_purchase_orders_currency_rub",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    number: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    supplier_id: Mapped[int] = mapped_column(
        ForeignKey("suppliers.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default=PurchaseOrderStatus.DRAFT.value,
        server_default=PurchaseOrderStatus.DRAFT.value,
        index=True,
    )
    expected_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    warehouse_id: Mapped[int | None] = mapped_column(
        ForeignKey("warehouses.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    currency: Mapped[str] = mapped_column(
        String(3), nullable=False, default="RUB", server_default="RUB"
    )
    ordered_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    cancelled_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
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

    lines: Mapped[list[PurchaseOrderLine]] = relationship(
        back_populates="purchase_order",
        order_by="PurchaseOrderLine.id",
        cascade="all, delete-orphan",
    )


class PurchaseOrderLine(Base):
    """Line on a purchase order: nomenclature + qty + unit price."""

    __tablename__ = "purchase_order_lines"
    __table_args__ = (
        UniqueConstraint(
            "purchase_order_id",
            "nomenclature_id",
            name="uq_purchase_order_lines_po_nomenclature",
        ),
        CheckConstraint(
            "quantity > 0",
            name="ck_purchase_order_lines_quantity_positive",
        ),
        CheckConstraint(
            "unit_price > 0",
            name="ck_purchase_order_lines_unit_price_positive",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    purchase_order_id: Mapped[int] = mapped_column(
        ForeignKey("purchase_orders.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    nomenclature_id: Mapped[int] = mapped_column(
        ForeignKey("nomenclatures.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    quantity: Mapped[Decimal] = mapped_column(Numeric(14, 3), nullable=False)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    comment: Mapped[str | None] = mapped_column(String(255), nullable=True)
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

    purchase_order: Mapped[PurchaseOrder] = relationship(back_populates="lines")
