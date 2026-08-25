"""Stock register documents, ledger lines, and inventory recount (ADR-019)."""

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
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base

if TYPE_CHECKING:
    from app.models.nomenclature import Nomenclature
    from app.models.sales import SalesOrder
    from app.models.technical_card import TechnicalCard
    from app.models.warehouse import Warehouse


class StockDocumentType(str, Enum):
    """Movement types including FG subtypes and inventory recount (`12.4`)."""

    RECEIPT = "receipt"
    ISSUE = "issue"
    FG_RECEIPT = "fg_receipt"
    FG_ISSUE = "fg_issue"
    INVENTORY = "inventory"


class StockDocumentStatus(str, Enum):
    DRAFT = "draft"
    POSTED = "posted"
    CANCELLED = "cancelled"


class StockDocument(Base):
    """Stock movement header (Приход / Списание / FG / inventory). Balance SoT is ledger only."""

    __tablename__ = "stock_documents"
    __table_args__ = (
        UniqueConstraint("number", name="uq_stock_documents_number"),
        Index("ix_stock_documents_warehouse_id", "warehouse_id"),
        Index("ix_stock_documents_status", "status"),
        Index("ix_stock_documents_doc_type", "doc_type"),
        Index("ix_stock_documents_posted_at", "posted_at"),
        CheckConstraint(
            "doc_type IN ('receipt', 'issue', 'fg_receipt', 'fg_issue', 'inventory')",
            name="ck_stock_documents_doc_type",
        ),
        CheckConstraint(
            "status IN ('draft', 'posted', 'cancelled')",
            name="ck_stock_documents_status",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    number: Mapped[str] = mapped_column(String(80), nullable=False)
    doc_type: Mapped[str] = mapped_column(String(20), nullable=False)
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default=StockDocumentStatus.DRAFT.value,
        server_default=StockDocumentStatus.DRAFT.value,
    )
    warehouse_id: Mapped[int] = mapped_column(
        ForeignKey("warehouses.id", ondelete="RESTRICT"),
        nullable=False,
    )
    posted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    technical_card_id: Mapped[int | None] = mapped_column(
        ForeignKey("technical_cards.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    sales_order_id: Mapped[int | None] = mapped_column(
        ForeignKey("sales_orders.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
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

    warehouse: Mapped[Warehouse] = relationship()
    technical_card: Mapped[TechnicalCard | None] = relationship()
    sales_order: Mapped[SalesOrder | None] = relationship()
    ledger_lines: Mapped[list[StockLedgerLine]] = relationship(
        back_populates="stock_document",
        cascade="all, delete-orphan",
        order_by="StockLedgerLine.line_no",
    )
    inventory_lines: Mapped[list[StockInventoryLine]] = relationship(
        back_populates="stock_document",
        cascade="all, delete-orphan",
        order_by="StockInventoryLine.sequence",
    )


class StockLedgerLine(Base):
    """Register line; signed qty is SoT for balances (ADR-012 / ADR-019)."""

    __tablename__ = "stock_ledger_lines"
    __table_args__ = (
        UniqueConstraint(
            "stock_document_id",
            "line_no",
            name="uq_stock_ledger_lines_document_line_no",
        ),
        Index(
            "ix_stock_ledger_lines_warehouse_nomenclature",
            "warehouse_id",
            "nomenclature_id",
        ),
        Index("ix_stock_ledger_lines_nomenclature_id", "nomenclature_id"),
        Index("ix_stock_ledger_lines_posted_at", "posted_at"),
        CheckConstraint(
            "quantity != 0",
            name="ck_stock_ledger_lines_quantity_nonzero",
        ),
        CheckConstraint("line_no >= 1", name="ck_stock_ledger_lines_line_no"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    stock_document_id: Mapped[int] = mapped_column(
        ForeignKey("stock_documents.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    line_no: Mapped[int] = mapped_column(Integer, nullable=False)
    warehouse_id: Mapped[int] = mapped_column(
        ForeignKey("warehouses.id", ondelete="RESTRICT"),
        nullable=False,
    )
    nomenclature_id: Mapped[int] = mapped_column(
        ForeignKey("nomenclatures.id", ondelete="RESTRICT"),
        nullable=False,
    )
    quantity: Mapped[Decimal] = mapped_column(Numeric(14, 3), nullable=False)
    posted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    technical_card_id: Mapped[int | None] = mapped_column(
        ForeignKey("technical_cards.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    sales_order_id: Mapped[int | None] = mapped_column(
        ForeignKey("sales_orders.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    stock_document: Mapped[StockDocument] = relationship(
        back_populates="ledger_lines"
    )
    warehouse: Mapped[Warehouse] = relationship()
    nomenclature: Mapped[Nomenclature] = relationship()
    technical_card: Mapped[TechnicalCard | None] = relationship()
    sales_order: Mapped[SalesOrder | None] = relationship()


class StockInventoryLine(Base):
    """Recount line: book snapshot + counted qty (ADR-019 / 12.4). Not a ledger row."""

    __tablename__ = "stock_inventory_lines"
    __table_args__ = (
        UniqueConstraint(
            "stock_document_id",
            "nomenclature_id",
            name="uq_stock_inventory_lines_document_nomenclature",
        ),
        UniqueConstraint(
            "stock_document_id",
            "sequence",
            name="uq_stock_inventory_lines_document_sequence",
        ),
        Index("ix_stock_inventory_lines_nomenclature_id", "nomenclature_id"),
        CheckConstraint("sequence >= 1", name="ck_stock_inventory_lines_sequence"),
        CheckConstraint(
            "counted_qty >= 0",
            name="ck_stock_inventory_lines_counted_qty_nonnegative",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    stock_document_id: Mapped[int] = mapped_column(
        ForeignKey("stock_documents.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    sequence: Mapped[int] = mapped_column(Integer, nullable=False)
    nomenclature_id: Mapped[int] = mapped_column(
        ForeignKey("nomenclatures.id", ondelete="RESTRICT"),
        nullable=False,
    )
    book_qty: Mapped[Decimal] = mapped_column(Numeric(14, 3), nullable=False)
    counted_qty: Mapped[Decimal] = mapped_column(Numeric(14, 3), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    stock_document: Mapped[StockDocument] = relationship(
        back_populates="inventory_lines"
    )
    nomenclature: Mapped[Nomenclature] = relationship()
