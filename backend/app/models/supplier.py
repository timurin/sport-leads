"""Procurement suppliers and supplier prices (Stage 13.1.1 / ADR-033)."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    CheckConstraint,
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


class Supplier(Base):
    """Procurement supplier master (Закупки). Not CRM Client."""

    __tablename__ = "suppliers"
    __table_args__ = (
        UniqueConstraint("code", name="uq_suppliers_code"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    code: Mapped[str | None] = mapped_column(String(50), nullable=True, index=True)
    inn: Mapped[str | None] = mapped_column(String(12), nullable=True, index=True)
    kpp: Mapped[str | None] = mapped_column(String(9), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    legal_address: Mapped[str | None] = mapped_column(String(500), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, index=True
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

    prices: Mapped[list[SupplierPrice]] = relationship(
        back_populates="supplier",
        order_by="SupplierPrice.id",
    )


class SupplierPrice(Base):
    """Procurement unit price for a nomenclature at a supplier."""

    __tablename__ = "supplier_prices"
    __table_args__ = (
        UniqueConstraint(
            "supplier_id",
            "nomenclature_id",
            name="uq_supplier_prices_supplier_nomenclature",
        ),
        CheckConstraint(
            "unit_price > 0",
            name="ck_supplier_prices_unit_price_positive",
        ),
        CheckConstraint(
            "currency = 'RUB'",
            name="ck_supplier_prices_currency_rub",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    supplier_id: Mapped[int] = mapped_column(
        ForeignKey("suppliers.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    nomenclature_id: Mapped[int] = mapped_column(
        ForeignKey("nomenclatures.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    unit_price: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    currency: Mapped[str] = mapped_column(
        String(3), nullable=False, default="RUB", server_default="RUB"
    )
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

    supplier: Mapped[Supplier] = relationship(back_populates="prices")
