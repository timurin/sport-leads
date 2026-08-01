"""Commercial quotations and invoices (roadmap 3.3.3) — live on SalesOrder."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from enum import Enum

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base
from app.models.sales import enum_type


class CommercialDocumentStatus(str, Enum):
    DRAFT = "draft"
    ISSUED = "issued"
    CANCELLED = "cancelled"


class SalesQuotation(Base):
    __tablename__ = "sales_quotations"
    __table_args__ = (
        UniqueConstraint("number", name="uq_sales_quotations_number"),
        CheckConstraint(
            "discount_percent IS NULL OR (discount_percent >= 0 AND discount_percent <= 100)",
            name="ck_sales_quotations_discount_percent_range",
        ),
        CheckConstraint(
            "discount_amount >= 0",
            name="ck_sales_quotations_discount_amount_nonnegative",
        ),
        CheckConstraint(
            "vat_amount >= 0",
            name="ck_sales_quotations_vat_amount_nonnegative",
        ),
        CheckConstraint(
            "amount >= 0",
            name="ck_sales_quotations_amount_nonnegative",
        ),
        CheckConstraint(
            "length(currency_code) = 3",
            name="ck_sales_quotations_currency_code_length",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    number: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    sales_order_id: Mapped[int] = mapped_column(
        ForeignKey("sales_orders.id", ondelete="CASCADE"), nullable=False, index=True
    )
    status: Mapped[CommercialDocumentStatus] = mapped_column(
        enum_type(CommercialDocumentStatus, "commercial_document_status"),
        nullable=False,
        default=CommercialDocumentStatus.DRAFT,
        index=True,
    )
    currency_code: Mapped[str] = mapped_column(
        String(3), nullable=False, default="RUB", server_default=text("'RUB'")
    )
    discount_percent: Mapped[Decimal | None] = mapped_column(Numeric(5, 2), nullable=True)
    discount_amount: Mapped[Decimal] = mapped_column(
        Numeric(14, 2), nullable=False, default=Decimal("0.00")
    )
    vat_amount: Mapped[Decimal] = mapped_column(
        Numeric(14, 2), nullable=False, default=Decimal("0.00")
    )
    amount: Mapped[Decimal] = mapped_column(
        Numeric(14, 2), nullable=False, default=Decimal("0.00")
    )
    amount_net: Mapped[Decimal] = mapped_column(
        Numeric(14, 2), nullable=False, default=Decimal("0.00")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )
    items: Mapped[list["SalesQuotationItem"]] = relationship(
        back_populates="quotation",
        cascade="all, delete-orphan",
        order_by="SalesQuotationItem.position, SalesQuotationItem.id",
    )


class SalesQuotationItem(Base):
    __tablename__ = "sales_quotation_items"
    __table_args__ = (
        CheckConstraint("quantity > 0", name="ck_sales_quotation_items_quantity_positive"),
        CheckConstraint("unit_price >= 0", name="ck_sales_quotation_items_unit_price_nonnegative"),
        CheckConstraint(
            "discount_percent IS NULL OR (discount_percent >= 0 AND discount_percent <= 100)",
            name="ck_sales_quotation_items_discount_percent_range",
        ),
        CheckConstraint(
            "discount_amount >= 0",
            name="ck_sales_quotation_items_discount_amount_nonnegative",
        ),
        CheckConstraint(
            "line_amount >= 0",
            name="ck_sales_quotation_items_line_amount_nonnegative",
        ),
        CheckConstraint(
            "vat_amount >= 0",
            name="ck_sales_quotation_items_vat_amount_nonnegative",
        ),
        CheckConstraint(
            "line_total >= 0",
            name="ck_sales_quotation_items_line_total_nonnegative",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    quotation_id: Mapped[int] = mapped_column(
        ForeignKey("sales_quotations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    source_order_item_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    position: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    snapshot_name: Mapped[str] = mapped_column(String(255), nullable=False)
    unit: Mapped[str] = mapped_column(String(30), nullable=False, default="шт")
    quantity: Mapped[Decimal] = mapped_column(Numeric(14, 3), nullable=False)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    discount_percent: Mapped[Decimal | None] = mapped_column(Numeric(5, 2), nullable=True)
    discount_amount: Mapped[Decimal] = mapped_column(
        Numeric(14, 2), nullable=False, default=Decimal("0.00")
    )
    line_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    vat_rate_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    vat_rate_percent: Mapped[Decimal | None] = mapped_column(Numeric(5, 2), nullable=True)
    price_includes_vat: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    vat_amount: Mapped[Decimal] = mapped_column(
        Numeric(14, 2), nullable=False, default=Decimal("0.00")
    )
    line_total: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    quotation: Mapped[SalesQuotation] = relationship(back_populates="items")


class SalesInvoice(Base):
    __tablename__ = "sales_invoices"
    __table_args__ = (
        UniqueConstraint("number", name="uq_sales_invoices_number"),
        CheckConstraint(
            "discount_percent IS NULL OR (discount_percent >= 0 AND discount_percent <= 100)",
            name="ck_sales_invoices_discount_percent_range",
        ),
        CheckConstraint(
            "discount_amount >= 0",
            name="ck_sales_invoices_discount_amount_nonnegative",
        ),
        CheckConstraint(
            "vat_amount >= 0",
            name="ck_sales_invoices_vat_amount_nonnegative",
        ),
        CheckConstraint(
            "amount >= 0",
            name="ck_sales_invoices_amount_nonnegative",
        ),
        CheckConstraint(
            "length(currency_code) = 3",
            name="ck_sales_invoices_currency_code_length",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    number: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    sales_order_id: Mapped[int] = mapped_column(
        ForeignKey("sales_orders.id", ondelete="CASCADE"), nullable=False, index=True
    )
    quotation_id: Mapped[int | None] = mapped_column(
        ForeignKey("sales_quotations.id", ondelete="SET NULL"), nullable=True, index=True
    )
    status: Mapped[CommercialDocumentStatus] = mapped_column(
        enum_type(CommercialDocumentStatus, "commercial_document_status"),
        nullable=False,
        default=CommercialDocumentStatus.DRAFT,
        index=True,
    )
    currency_code: Mapped[str] = mapped_column(
        String(3), nullable=False, default="RUB", server_default=text("'RUB'")
    )
    discount_percent: Mapped[Decimal | None] = mapped_column(Numeric(5, 2), nullable=True)
    discount_amount: Mapped[Decimal] = mapped_column(
        Numeric(14, 2), nullable=False, default=Decimal("0.00")
    )
    vat_amount: Mapped[Decimal] = mapped_column(
        Numeric(14, 2), nullable=False, default=Decimal("0.00")
    )
    amount: Mapped[Decimal] = mapped_column(
        Numeric(14, 2), nullable=False, default=Decimal("0.00")
    )
    amount_net: Mapped[Decimal] = mapped_column(
        Numeric(14, 2), nullable=False, default=Decimal("0.00")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )
    items: Mapped[list["SalesInvoiceItem"]] = relationship(
        back_populates="invoice",
        cascade="all, delete-orphan",
        order_by="SalesInvoiceItem.position, SalesInvoiceItem.id",
    )


class SalesInvoiceItem(Base):
    __tablename__ = "sales_invoice_items"
    __table_args__ = (
        CheckConstraint("quantity > 0", name="ck_sales_invoice_items_quantity_positive"),
        CheckConstraint("unit_price >= 0", name="ck_sales_invoice_items_unit_price_nonnegative"),
        CheckConstraint(
            "discount_percent IS NULL OR (discount_percent >= 0 AND discount_percent <= 100)",
            name="ck_sales_invoice_items_discount_percent_range",
        ),
        CheckConstraint(
            "discount_amount >= 0",
            name="ck_sales_invoice_items_discount_amount_nonnegative",
        ),
        CheckConstraint(
            "line_amount >= 0",
            name="ck_sales_invoice_items_line_amount_nonnegative",
        ),
        CheckConstraint(
            "vat_amount >= 0",
            name="ck_sales_invoice_items_vat_amount_nonnegative",
        ),
        CheckConstraint(
            "line_total >= 0",
            name="ck_sales_invoice_items_line_total_nonnegative",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    invoice_id: Mapped[int] = mapped_column(
        ForeignKey("sales_invoices.id", ondelete="CASCADE"), nullable=False, index=True
    )
    source_order_item_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    position: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    snapshot_name: Mapped[str] = mapped_column(String(255), nullable=False)
    unit: Mapped[str] = mapped_column(String(30), nullable=False, default="шт")
    quantity: Mapped[Decimal] = mapped_column(Numeric(14, 3), nullable=False)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    discount_percent: Mapped[Decimal | None] = mapped_column(Numeric(5, 2), nullable=True)
    discount_amount: Mapped[Decimal] = mapped_column(
        Numeric(14, 2), nullable=False, default=Decimal("0.00")
    )
    line_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    vat_rate_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    vat_rate_percent: Mapped[Decimal | None] = mapped_column(Numeric(5, 2), nullable=True)
    price_includes_vat: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    vat_amount: Mapped[Decimal] = mapped_column(
        Numeric(14, 2), nullable=False, default=Decimal("0.00")
    )
    line_total: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    invoice: Mapped[SalesInvoice] = relationship(back_populates="items")
