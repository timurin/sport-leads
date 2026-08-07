"""Stage 12.2.2 — post StockDocument and read balances from ledger."""

from __future__ import annotations

from decimal import Decimal

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, inspect
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.database.base import Base
from app.database.session import get_db
from app.main import app
from app.models.nomenclature import Nomenclature, NomenclatureType
from app.models.warehouse import Warehouse


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
    db.commit()
    return warehouse.id, product.id


def test_post_receipt_and_issue_updates_balances_not_nomenclature() -> None:
    factory = _session_factory()

    def override_get_db():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with factory() as db:
            warehouse_id, product_id = _seed(db)

        with TestClient(app) as client:
            empty = client.get("/stock/balances")
            assert empty.status_code == 200
            assert empty.json() == []

            receipt = client.post(
                "/stock/documents",
                json={
                    "doc_type": "receipt",
                    "warehouse_id": warehouse_id,
                    "lines": [
                        {"nomenclature_id": product_id, "quantity": "10.000"}
                    ],
                    "post": True,
                },
            )
            assert receipt.status_code == 201, receipt.text
            body = receipt.json()
            assert body["status"] == "posted"
            assert body["doc_type"] == "receipt"
            assert len(body["ledger_lines"]) == 1
            assert body["ledger_lines"][0]["quantity"] == "10.000"
            assert body["ledger_lines"][0]["nomenclature_name"] == "Футболка PRO"
            assert body["posted_at"] is not None

            detail = client.get(f"/stock/documents/{body['id']}")
            assert detail.status_code == 200, detail.text
            assert detail.json()["ledger_lines"][0]["nomenclature_name"] == "Футболка PRO"

            balances = client.get("/stock/balances")
            assert balances.status_code == 200
            rows = balances.json()
            assert len(rows) == 1
            assert rows[0]["nomenclature_id"] == product_id
            assert rows[0]["warehouse_id"] is None
            assert Decimal(rows[0]["quantity"]) == Decimal("10.000")

            scoped = client.get(
                "/stock/balances",
                params={"warehouse_id": warehouse_id, "nomenclature_id": product_id},
            )
            assert scoped.status_code == 200
            scoped_rows = scoped.json()
            assert len(scoped_rows) == 1
            assert scoped_rows[0]["warehouse_id"] == warehouse_id
            assert Decimal(scoped_rows[0]["quantity"]) == Decimal("10.000")

            draft = client.post(
                "/stock/documents",
                json={
                    "doc_type": "issue",
                    "warehouse_id": warehouse_id,
                    "lines": [
                        {"nomenclature_id": product_id, "quantity": "3.000"}
                    ],
                    "post": False,
                },
            )
            assert draft.status_code == 201, draft.text
            assert draft.json()["status"] == "draft"
            assert draft.json()["ledger_lines"][0]["quantity"] == "-3.000"

            # Draft must not affect balances yet.
            mid = client.get("/stock/balances")
            assert Decimal(mid.json()[0]["quantity"]) == Decimal("10.000")

            posted = client.post(f"/stock/documents/{draft.json()['id']}/post")
            assert posted.status_code == 200, posted.text
            assert posted.json()["status"] == "posted"

            after = client.get("/stock/balances")
            assert Decimal(after.json()[0]["quantity"]) == Decimal("7.000")

            fetched = client.get(f"/stock/documents/{receipt.json()['id']}")
            assert fetched.status_code == 200
            assert fetched.json()["number"].startswith("STK-")

        columns = {column.name for column in inspect(Nomenclature).columns}
        assert "balance" not in columns
    finally:
        app.dependency_overrides.pop(get_db, None)


def test_create_stock_document_rejects_unknown_warehouse() -> None:
    factory = _session_factory()

    def override_get_db():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with factory() as db:
            _, product_id = _seed(db)

        with TestClient(app) as client:
            response = client.post(
                "/stock/documents",
                json={
                    "doc_type": "receipt",
                    "warehouse_id": 99999,
                    "lines": [
                        {"nomenclature_id": product_id, "quantity": "1"}
                    ],
                },
            )
            assert response.status_code == 422
    finally:
        app.dependency_overrides.pop(get_db, None)
