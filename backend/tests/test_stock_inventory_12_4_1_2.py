"""Stage 12.4.1.2 — inventory doc type + recount lines persistence (ADR-019)."""

from __future__ import annotations

from decimal import Decimal

import pytest
from sqlalchemy import create_engine, inspect, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.database.base import Base
from app.models.nomenclature import Nomenclature, NomenclatureType
from app.models.stock import (
    StockDocument,
    StockDocumentStatus,
    StockDocumentType,
    StockInventoryLine,
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


def test_inventory_tables_and_type_are_registered() -> None:
    assert StockDocumentType.INVENTORY.value == "inventory"
    table_names = set(Base.metadata.tables)
    assert "stock_inventory_lines" in table_names
    columns = {column.name for column in inspect(StockInventoryLine).columns}
    assert "book_qty" in columns
    assert "counted_qty" in columns
    assert "nomenclature_id" in columns


def test_inventory_document_and_recount_line_persist() -> None:
    factory = _session_factory()

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
            number="STK-2026-0100",
            doc_type=StockDocumentType.INVENTORY.value,
            status=StockDocumentStatus.DRAFT.value,
            warehouse_id=warehouse.id,
        )
        db.add(document)
        db.flush()

        line = StockInventoryLine(
            stock_document_id=document.id,
            sequence=1,
            nomenclature_id=product.id,
            book_qty=Decimal("10.000"),
            counted_qty=Decimal("9.500"),
        )
        db.add(line)
        db.commit()

        loaded = db.scalars(
            select(StockDocument).where(StockDocument.number == "STK-2026-0100")
        ).one()
        assert loaded.doc_type == "inventory"
        assert loaded.technical_card_id is None
        assert loaded.sales_order_id is None
        assert len(loaded.inventory_lines) == 1
        recount = loaded.inventory_lines[0]
        assert recount.book_qty == Decimal("10.000")
        assert recount.counted_qty == Decimal("9.500")
        assert recount.nomenclature_id == product.id


def test_inventory_line_nomenclature_unique_per_document() -> None:
    factory = _session_factory()

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
            number="STK-2026-0101",
            doc_type=StockDocumentType.INVENTORY.value,
            status=StockDocumentStatus.DRAFT.value,
            warehouse_id=warehouse.id,
        )
        db.add(document)
        db.flush()

        db.add(
            StockInventoryLine(
                stock_document_id=document.id,
                sequence=1,
                nomenclature_id=product.id,
                book_qty=Decimal("1.000"),
                counted_qty=Decimal("1.000"),
            )
        )
        db.flush()
        db.add(
            StockInventoryLine(
                stock_document_id=document.id,
                sequence=2,
                nomenclature_id=product.id,
                book_qty=Decimal("1.000"),
                counted_qty=Decimal("2.000"),
            )
        )
        with pytest.raises(IntegrityError):
            db.flush()
