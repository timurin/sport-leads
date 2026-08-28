"""Stage 12.5.1.2 — transfer doc type + destination warehouse + transfer lines."""

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
    StockTransferLine,
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


def test_transfer_tables_and_type_are_registered() -> None:
    assert StockDocumentType.TRANSFER.value == "transfer"
    table_names = set(Base.metadata.tables)
    assert "stock_transfer_lines" in table_names
    columns = {column.name for column in inspect(StockTransferLine).columns}
    assert "quantity" in columns
    assert "nomenclature_id" in columns
    header = {column.name for column in inspect(StockDocument).columns}
    assert "destination_warehouse_id" in header


def test_transfer_document_and_line_persist() -> None:
    factory = _session_factory()

    with factory() as db:
        source = Warehouse(
            name="Основной",
            code="main",
            is_active=True,
            is_default=True,
        )
        dest = Warehouse(
            name="Цех",
            code="shop",
            is_active=True,
            is_default=False,
        )
        product = Nomenclature(
            name="Футболка PRO",
            category="Форма",
            nomenclature_type=NomenclatureType.PRODUCT,
            unit="шт",
            base_price=Decimal("1500.00"),
        )
        db.add_all([source, dest, product])
        db.flush()

        document = StockDocument(
            number="STK-2026-0200",
            doc_type=StockDocumentType.TRANSFER.value,
            status=StockDocumentStatus.DRAFT.value,
            warehouse_id=source.id,
            destination_warehouse_id=dest.id,
        )
        db.add(document)
        db.flush()

        line = StockTransferLine(
            stock_document_id=document.id,
            sequence=1,
            nomenclature_id=product.id,
            quantity=Decimal("3.000"),
        )
        db.add(line)
        db.commit()

        loaded = db.scalars(
            select(StockDocument).where(StockDocument.number == "STK-2026-0200")
        ).one()
        assert loaded.doc_type == "transfer"
        assert loaded.destination_warehouse_id == dest.id
        assert loaded.technical_card_id is None
        assert loaded.sales_order_id is None
        assert len(loaded.transfer_lines) == 1
        assert loaded.transfer_lines[0].quantity == Decimal("3.000")


def test_transfer_line_nomenclature_unique_per_document() -> None:
    factory = _session_factory()

    with factory() as db:
        source = Warehouse(
            name="Основной",
            code="main",
            is_active=True,
            is_default=True,
        )
        dest = Warehouse(
            name="Цех",
            code="shop",
            is_active=True,
            is_default=False,
        )
        product = Nomenclature(
            name="Футболка PRO",
            category="Форма",
            nomenclature_type=NomenclatureType.PRODUCT,
            unit="шт",
            base_price=Decimal("1500.00"),
        )
        db.add_all([source, dest, product])
        db.flush()

        document = StockDocument(
            number="STK-2026-0201",
            doc_type=StockDocumentType.TRANSFER.value,
            status=StockDocumentStatus.DRAFT.value,
            warehouse_id=source.id,
            destination_warehouse_id=dest.id,
        )
        db.add(document)
        db.flush()
        db.add(
            StockTransferLine(
                stock_document_id=document.id,
                sequence=1,
                nomenclature_id=product.id,
                quantity=Decimal("1.000"),
            )
        )
        db.flush()
        db.add(
            StockTransferLine(
                stock_document_id=document.id,
                sequence=2,
                nomenclature_id=product.id,
                quantity=Decimal("2.000"),
            )
        )
        with pytest.raises(IntegrityError):
            db.flush()
