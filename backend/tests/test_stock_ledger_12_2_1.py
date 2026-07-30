"""Stage 12.2.1 — StockDocument + StockLedgerLine persistence (ADR-019)."""

from __future__ import annotations

from datetime import UTC, datetime
from decimal import Decimal

from sqlalchemy import create_engine, inspect, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.database.base import Base
from app.models.nomenclature import Nomenclature, NomenclatureType
from app.models.stock import (
    StockDocument,
    StockDocumentStatus,
    StockDocumentType,
    StockLedgerLine,
)
from app.models.warehouse import Warehouse


def _session_factory() -> sessionmaker[Session]:
    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine, expire_on_commit=False)


def test_stock_document_and_ledger_line_persist_decimal_and_tz() -> None:
    factory = _session_factory()
    posted_at = datetime(2026, 7, 30, 12, 0, tzinfo=UTC)

    with factory() as db:
        warehouse = Warehouse(
            name="Основной",
            code="main",
            is_active=True,
            is_default=True,
        )
        product = Nomenclature(
            name="Футболка PRO",
            category="Форма",
            nomenclature_type=NomenclatureType.PRODUCT,
            unit="шт",
            base_price=Decimal("1500.00"),
        )
        db.add_all([warehouse, product])
        db.flush()

        document = StockDocument(
            number="STK-2026-0001",
            doc_type=StockDocumentType.RECEIPT.value,
            status=StockDocumentStatus.POSTED.value,
            warehouse_id=warehouse.id,
            posted_at=posted_at,
        )
        db.add(document)
        db.flush()

        line = StockLedgerLine(
            stock_document_id=document.id,
            line_no=1,
            warehouse_id=warehouse.id,
            nomenclature_id=product.id,
            quantity=Decimal("12.500"),
            posted_at=posted_at,
        )
        db.add(line)
        db.commit()

        loaded_doc = db.scalars(
            select(StockDocument).where(StockDocument.number == "STK-2026-0001")
        ).one()
        assert loaded_doc.doc_type == "receipt"
        assert loaded_doc.status == "posted"
        assert loaded_doc.posted_at is not None
        assert loaded_doc.posted_at.tzinfo is not None

        loaded_line = db.scalars(
            select(StockLedgerLine).where(
                StockLedgerLine.stock_document_id == loaded_doc.id
            )
        ).one()
        assert loaded_line.quantity == Decimal("12.500")
        assert loaded_line.posted_at is not None
        assert loaded_line.posted_at.tzinfo is not None
        assert loaded_line.nomenclature_id == product.id


def test_nomenclature_has_no_balance_column() -> None:
    """ADR-012: balance never lives on Nomenclature row."""
    columns = {column.name for column in inspect(Nomenclature).columns}
    assert "balance" not in columns
    assert "minimum_balance" not in columns
    assert "warehouse" not in columns

    table_names = set(Base.metadata.tables)
    assert "stock_documents" in table_names
    assert "stock_ledger_lines" in table_names
    assert "warehouses" in table_names
