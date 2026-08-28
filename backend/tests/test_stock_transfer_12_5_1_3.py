"""Stage 12.5.1.3 — transfer create, lines, paired ledger post (ADR-019)."""

from __future__ import annotations

from decimal import Decimal

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.database.base import Base
from app.models.nomenclature import Nomenclature, NomenclatureType
from app.models.stock import StockDocumentStatus, StockDocumentType
from app.models.warehouse import Warehouse
from app.schemas.stock import StockDocumentCreate, StockDocumentLineCreate
from app.services.stock_balances import list_stock_balances
from app.services.stock_documents import (
    StockDocumentValidationError,
    create_stock_document,
)
from app.services.stock_transfer import (
    create_transfer_document,
    post_transfer_document,
    remove_transfer_line,
    set_transfer_line,
)


def _session_factory() -> sessionmaker[Session]:
    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine, expire_on_commit=False)


def _seed(db: Session) -> tuple[int, int, int]:
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
    return source.id, dest.id, product.id


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


def test_create_transfer_draft_uses_stk_number_without_ledger() -> None:
    factory = _session_factory()
    with factory() as db:
        source_id, dest_id, product_id = _seed(db)
        document = create_transfer_document(
            db,
            warehouse_id=source_id,
            destination_warehouse_id=dest_id,
            lines=[(product_id, Decimal("2.000"))],
        )
        assert document.doc_type == StockDocumentType.TRANSFER.value
        assert document.status == StockDocumentStatus.DRAFT.value
        assert document.number.startswith("STK-")
        assert document.warehouse_id == source_id
        assert document.destination_warehouse_id == dest_id
        assert document.ledger_lines == []
        assert len(document.transfer_lines) == 1
        assert document.transfer_lines[0].quantity == Decimal("2.000")


def test_same_warehouse_is_rejected() -> None:
    factory = _session_factory()
    with factory() as db:
        source_id, _dest_id, _product_id = _seed(db)
        with pytest.raises(StockDocumentValidationError):
            create_transfer_document(
                db,
                warehouse_id=source_id,
                destination_warehouse_id=source_id,
            )


def test_set_and_remove_transfer_line() -> None:
    factory = _session_factory()
    with factory() as db:
        source_id, dest_id, product_id = _seed(db)
        document = create_transfer_document(
            db,
            warehouse_id=source_id,
            destination_warehouse_id=dest_id,
        )
        updated = set_transfer_line(
            db, document.id, product_id, quantity=Decimal("4.000")
        )
        assert len(updated.transfer_lines) == 1
        assert updated.transfer_lines[0].quantity == Decimal("4.000")
        set_transfer_line(db, document.id, product_id, quantity=Decimal("1.500"))
        removed = remove_transfer_line(db, document.id, product_id)
        assert removed.transfer_lines == []


def test_post_writes_paired_ledger_and_moves_balance() -> None:
    factory = _session_factory()
    with factory() as db:
        source_id, dest_id, product_id = _seed(db)
        _post_receipt(db, source_id, product_id, "10.000")
        document = create_transfer_document(
            db,
            warehouse_id=source_id,
            destination_warehouse_id=dest_id,
            lines=[(product_id, Decimal("3.000"))],
        )
        posted = post_transfer_document(db, document.id)
        assert posted.status == StockDocumentStatus.POSTED.value
        assert posted.posted_at is not None
        assert len(posted.ledger_lines) == 2
        source_line = next(
            line for line in posted.ledger_lines if line.warehouse_id == source_id
        )
        dest_line = next(
            line for line in posted.ledger_lines if line.warehouse_id == dest_id
        )
        assert source_line.quantity == Decimal("-3.000")
        assert dest_line.quantity == Decimal("3.000")
        source_bal = list_stock_balances(
            db, warehouse_id=source_id, nomenclature_ids=[product_id]
        )
        dest_bal = list_stock_balances(
            db, warehouse_id=dest_id, nomenclature_ids=[product_id]
        )
        assert source_bal[0].quantity == Decimal("7.000")
        assert dest_bal[0].quantity == Decimal("3.000")


def test_post_empty_lines_rejected() -> None:
    factory = _session_factory()
    with factory() as db:
        source_id, dest_id, _product_id = _seed(db)
        document = create_transfer_document(
            db,
            warehouse_id=source_id,
            destination_warehouse_id=dest_id,
        )
        with pytest.raises(StockDocumentValidationError):
            post_transfer_document(db, document.id)


def test_post_does_not_block_negative_source() -> None:
    factory = _session_factory()
    with factory() as db:
        source_id, dest_id, product_id = _seed(db)
        document = create_transfer_document(
            db,
            warehouse_id=source_id,
            destination_warehouse_id=dest_id,
            lines=[(product_id, Decimal("2.000"))],
        )
        post_transfer_document(db, document.id)
        source_bal = list_stock_balances(
            db, warehouse_id=source_id, nomenclature_ids=[product_id]
        )
        dest_bal = list_stock_balances(
            db, warehouse_id=dest_id, nomenclature_ids=[product_id]
        )
        assert source_bal[0].quantity == Decimal("-2.000")
        assert dest_bal[0].quantity == Decimal("2.000")


def test_posted_transfer_is_immutable() -> None:
    factory = _session_factory()
    with factory() as db:
        source_id, dest_id, product_id = _seed(db)
        document = create_transfer_document(
            db,
            warehouse_id=source_id,
            destination_warehouse_id=dest_id,
            lines=[(product_id, Decimal("1.000"))],
        )
        post_transfer_document(db, document.id)
        with pytest.raises(StockDocumentValidationError):
            post_transfer_document(db, document.id)
        with pytest.raises(StockDocumentValidationError):
            set_transfer_line(
                db, document.id, product_id, quantity=Decimal("2.000")
            )
        with pytest.raises(StockDocumentValidationError):
            remove_transfer_line(db, document.id, product_id)
