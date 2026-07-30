"""Stage 12.1.2 — balance projection dimension by warehouse × nomenclature."""

from __future__ import annotations

from decimal import Decimal

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.database.base import Base
from app.database.session import get_db
from app.main import app
from app.models.warehouse import Warehouse
from app.services.stock_balances import (
    LedgerQuantityRow,
    project_balances_from_ledger_rows,
)


def _session_factory() -> sessionmaker[Session]:
    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine, expire_on_commit=False)


def test_project_balances_from_ledger_rows_warehouse_and_aggregate() -> None:
    rows = [
        LedgerQuantityRow(1, 10, Decimal("5")),
        LedgerQuantityRow(1, 10, Decimal("2")),
        LedgerQuantityRow(2, 10, Decimal("3")),
        LedgerQuantityRow(1, 20, Decimal("1")),
        LedgerQuantityRow(2, 99, Decimal("0")),
    ]

    aggregated = project_balances_from_ledger_rows(rows)
    by_nom = {row.nomenclature_id: row for row in aggregated}
    assert set(by_nom) == {10, 20}
    assert by_nom[10].warehouse_id is None
    assert by_nom[10].quantity == Decimal("10")
    assert by_nom[20].quantity == Decimal("1")

    scoped = project_balances_from_ledger_rows(rows, warehouse_id=1)
    assert {(row.nomenclature_id, row.quantity) for row in scoped} == {
        (10, Decimal("7")),
        (20, Decimal("1")),
    }
    assert all(row.warehouse_id == 1 for row in scoped)

    filtered = project_balances_from_ledger_rows(
        rows, warehouse_id=1, nomenclature_ids=[20]
    )
    assert len(filtered) == 1
    assert filtered[0].nomenclature_id == 20

    assert project_balances_from_ledger_rows(rows, nomenclature_ids=[]) == []


def test_list_stock_balances_accepts_warehouse_filter_empty_until_ledger() -> None:
    factory = _session_factory()

    def override_get_db():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with factory() as db:
            db.add(
                Warehouse(
                    name="Основной",
                    code="main",
                    is_active=True,
                    is_default=True,
                )
            )
            db.add(
                Warehouse(
                    name="Архив",
                    code="archive",
                    is_active=False,
                    is_default=False,
                )
            )
            db.commit()
            active_id = db.scalars(
                select(Warehouse).where(Warehouse.code == "main")
            ).one().id
            inactive_id = db.scalars(
                select(Warehouse).where(Warehouse.code == "archive")
            ).one().id

        with TestClient(app) as client:
            empty = client.get("/stock/balances")
            assert empty.status_code == 200
            assert empty.json() == []

            scoped = client.get(
                "/stock/balances",
                params={"warehouse_id": active_id, "nomenclature_id": 1},
            )
            assert scoped.status_code == 200
            assert scoped.json() == []

            missing = client.get("/stock/balances", params={"warehouse_id": 99999})
            assert missing.status_code == 404

            inactive = client.get(
                "/stock/balances", params={"warehouse_id": inactive_id}
            )
            assert inactive.status_code == 422
    finally:
        app.dependency_overrides.pop(get_db, None)
