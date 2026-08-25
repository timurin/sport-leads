"""Stage 12.4.1.3 — inventory snapshot, counted qty, and delta post (ADR-019)."""

from __future__ import annotations

from decimal import Decimal

import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.database.base import Base
from app.models.nomenclature import Nomenclature, NomenclatureType
from app.models.stock import (
    StockDocumentStatus,
    StockDocumentType,
    StockLedgerLine,
)
from app.models.warehouse import Warehouse
from app.schemas.stock import StockDocumentCreate, StockDocumentLineCreate
from app.services.stock_balances import list_stock_balances
from app.services.stock_documents import (
    StockDocumentValidationError,
    create_stock_document,
)
from app.services.stock_inventory import (
    create_inventory_document,
    fill_inventory_from_balances,
    post_inventory_document,
    refresh_inventory_book,
    set_inventory_counted,
)


def _session_factory() -> sessionmaker[Session]:
    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine, expire_on_commit=False)


def _seed(db: Session) -> tuple[int, int]:
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
    return warehouse.id, product.id


def _post_receipt(db: Session, warehouse_id: int, product_id: int, qty: str) -> None:
    create_stock_document(
        db,
        StockDocumentCreate(
            doc_type="receipt",
            warehouse_id=warehouse_id,
            lines=[
                StockDocumentLineCreate(
                    nomenclature_id=product_id,
                    quantity=Decimal(qty),
                )
            ],
            post=True,
        ),
        commit=False,
    )


def test_create_inventory_draft_uses_stk_number_without_ledger() -> None:
    factory = _session_factory()
    with factory() as db:
        warehouse_id, _product_id = _seed(db)
        document = create_inventory_document(db, warehouse_id=warehouse_id)
        assert document.doc_type == StockDocumentType.INVENTORY.value
        assert document.status == StockDocumentStatus.DRAFT.value
        assert document.number.startswith("STK-")
        assert document.technical_card_id is None
        assert document.sales_order_id is None
        assert document.ledger_lines == []
        assert document.inventory_lines == []


def test_fill_snapshots_book_from_posted_ledger() -> None:
    factory = _session_factory()
    with factory() as db:
        warehouse_id, product_id = _seed(db)
        _post_receipt(db, warehouse_id, product_id, "10.000")
        document = create_inventory_document(db, warehouse_id=warehouse_id)
        filled = fill_inventory_from_balances(db, document.id)
        assert len(filled.inventory_lines) == 1
        line = filled.inventory_lines[0]
        assert line.nomenclature_id == product_id
        assert line.book_qty == Decimal("10.000")
        assert line.counted_qty == Decimal("10.000")
        assert filled.ledger_lines == []


def test_set_counted_and_refresh_keeps_counted() -> None:
    factory = _session_factory()
    with factory() as db:
        warehouse_id, product_id = _seed(db)
        _post_receipt(db, warehouse_id, product_id, "10.000")
        document = create_inventory_document(db, warehouse_id=warehouse_id)
        fill_inventory_from_balances(db, document.id)
        set_inventory_counted(
            db, document.id, product_id, counted_qty=Decimal("8.000")
        )
        create_stock_document(
            db,
            StockDocumentCreate(
                doc_type="receipt",
                warehouse_id=warehouse_id,
                lines=[
                    StockDocumentLineCreate(
                        nomenclature_id=product_id,
                        quantity=Decimal("2.000"),
                    )
                ],
                post=True,
            ),
            commit=False,
        )
        refreshed = refresh_inventory_book(db, document.id)
        line = refreshed.inventory_lines[0]
        assert line.book_qty == Decimal("12.000")
        assert line.counted_qty == Decimal("8.000")


def test_post_writes_signed_delta_and_updates_balance() -> None:
    factory = _session_factory()
    with factory() as db:
        warehouse_id, product_id = _seed(db)
        _post_receipt(db, warehouse_id, product_id, "10.000")
        document = create_inventory_document(db, warehouse_id=warehouse_id)
        fill_inventory_from_balances(db, document.id)
        set_inventory_counted(
            db, document.id, product_id, counted_qty=Decimal("12.000")
        )
        posted = post_inventory_document(db, document.id)
        assert posted.status == StockDocumentStatus.POSTED.value
        assert posted.posted_at is not None
        assert len(posted.ledger_lines) == 1
        assert posted.ledger_lines[0].quantity == Decimal("2.000")
        assert posted.ledger_lines[0].warehouse_id == warehouse_id
        balances = list_stock_balances(
            db, warehouse_id=warehouse_id, nomenclature_ids=[product_id]
        )
        assert len(balances) == 1
        assert balances[0].quantity == Decimal("12.000")


def test_post_all_zero_delta_allowed_without_ledger() -> None:
    factory = _session_factory()
    with factory() as db:
        warehouse_id, product_id = _seed(db)
        _post_receipt(db, warehouse_id, product_id, "4.000")
        document = create_inventory_document(db, warehouse_id=warehouse_id)
        fill_inventory_from_balances(db, document.id)
        posted = post_inventory_document(db, document.id)
        assert posted.status == StockDocumentStatus.POSTED.value
        assert posted.ledger_lines == []
        leftover = db.scalars(
            select(StockLedgerLine).where(
                StockLedgerLine.stock_document_id == posted.id
            )
        ).all()
        assert leftover == []


def test_post_shortage_does_not_block_negative_remainder() -> None:
    factory = _session_factory()
    with factory() as db:
        warehouse_id, product_id = _seed(db)
        _post_receipt(db, warehouse_id, product_id, "10.000")
        document = create_inventory_document(db, warehouse_id=warehouse_id)
        fill_inventory_from_balances(db, document.id)
        create_stock_document(
            db,
            StockDocumentCreate(
                doc_type="issue",
                warehouse_id=warehouse_id,
                lines=[
                    StockDocumentLineCreate(
                        nomenclature_id=product_id,
                        quantity=Decimal("10.000"),
                    )
                ],
                post=True,
            ),
            commit=False,
        )
        set_inventory_counted(
            db, document.id, product_id, counted_qty=Decimal("0")
        )
        post_inventory_document(db, document.id)
        balances = list_stock_balances(
            db, warehouse_id=warehouse_id, nomenclature_ids=[product_id]
        )
        assert len(balances) == 1
        assert balances[0].quantity == Decimal("-10.000")


def test_posted_inventory_is_immutable() -> None:
    factory = _session_factory()
    with factory() as db:
        warehouse_id, product_id = _seed(db)
        _post_receipt(db, warehouse_id, product_id, "1.000")
        document = create_inventory_document(db, warehouse_id=warehouse_id)
        fill_inventory_from_balances(db, document.id)
        post_inventory_document(db, document.id)
        with pytest.raises(StockDocumentValidationError):
            post_inventory_document(db, document.id)
        with pytest.raises(StockDocumentValidationError):
            set_inventory_counted(
                db, document.id, product_id, counted_qty=Decimal("2.000")
            )
        with pytest.raises(StockDocumentValidationError):
            refresh_inventory_book(db, document.id)
        with pytest.raises(StockDocumentValidationError):
            fill_inventory_from_balances(db, document.id)
