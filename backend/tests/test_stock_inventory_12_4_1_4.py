"""Stage 12.4.1.4 — inventory HTTP API (ADR-019)."""

from __future__ import annotations

from decimal import Decimal

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
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


def _bind(factory: sessionmaker[Session]) -> None:
    def override_get_db():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db


def test_inventory_api_create_fill_counted_post_and_slim_list() -> None:
    factory = _session_factory()
    _bind(factory)
    try:
        with factory() as db:
            warehouse_id, product_id = _seed(db)

        with TestClient(app) as client:
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

            created = client.post(
                "/stock/inventory",
                json={"warehouse_id": warehouse_id, "fill": True},
            )
            assert created.status_code == 201, created.text
            body = created.json()
            assert body["doc_type"] == "inventory"
            assert body["status"] == "draft"
            assert body["number"].startswith("STK-")
            assert body["ledger_lines"] == []
            assert len(body["inventory_lines"]) == 1
            line = body["inventory_lines"][0]
            assert line["nomenclature_id"] == product_id
            assert line["nomenclature_name"] == "Футболка PRO"
            assert Decimal(line["book_qty"]) == Decimal("10.000")
            assert Decimal(line["counted_qty"]) == Decimal("10.000")
            assert Decimal(line["delta"]) == Decimal("0")

            document_id = body["id"]
            counted = client.post(
                f"/stock/inventory/{document_id}/counted",
                json={"nomenclature_id": product_id, "counted_qty": "12.000"},
            )
            assert counted.status_code == 200, counted.text
            counted_line = counted.json()["inventory_lines"][0]
            assert Decimal(counted_line["counted_qty"]) == Decimal("12.000")
            assert Decimal(counted_line["delta"]) == Decimal("2.000")

            posted = client.post(f"/stock/inventory/{document_id}/post")
            assert posted.status_code == 200, posted.text
            assert posted.json()["status"] == "posted"
            assert len(posted.json()["ledger_lines"]) == 1
            assert Decimal(posted.json()["ledger_lines"][0]["quantity"]) == Decimal(
                "2.000"
            )

            detail = client.get(f"/stock/documents/{document_id}")
            assert detail.status_code == 200, detail.text
            assert len(detail.json()["inventory_lines"]) == 1
            assert detail.json()["inventory_lines"][0]["nomenclature_name"] == (
                "Футболка PRO"
            )

            listed = client.get(
                "/stock/documents", params={"doc_type": "inventory"}
            )
            assert listed.status_code == 200, listed.text
            rows = listed.json()
            assert len(rows) == 1
            assert rows[0]["id"] == document_id
            assert rows[0]["doc_type"] == "inventory"
            assert rows[0]["inventory_lines"] == []

            balances = client.get(
                "/stock/balances",
                params={
                    "warehouse_id": warehouse_id,
                    "nomenclature_id": product_id,
                },
            )
            assert balances.status_code == 200
            assert Decimal(balances.json()[0]["quantity"]) == Decimal("12.000")
    finally:
        app.dependency_overrides.pop(get_db, None)


def test_inventory_api_rejects_movement_post_and_second_post() -> None:
    factory = _session_factory()
    _bind(factory)
    try:
        with factory() as db:
            warehouse_id, _product_id = _seed(db)

        with TestClient(app) as client:
            created = client.post(
                "/stock/inventory",
                json={"warehouse_id": warehouse_id, "fill": False},
            )
            assert created.status_code == 201, created.text
            document_id = created.json()["id"]

            movement_post = client.post(f"/stock/documents/{document_id}/post")
            assert movement_post.status_code == 422, movement_post.text

            first = client.post(f"/stock/inventory/{document_id}/post")
            assert first.status_code == 200, first.text
            second = client.post(f"/stock/inventory/{document_id}/post")
            assert second.status_code == 422, second.text
    finally:
        app.dependency_overrides.pop(get_db, None)


def test_inventory_api_refresh_keeps_counted() -> None:
    factory = _session_factory()
    _bind(factory)
    try:
        with factory() as db:
            warehouse_id, product_id = _seed(db)

        with TestClient(app) as client:
            client.post(
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
            created = client.post(
                "/stock/inventory",
                json={"warehouse_id": warehouse_id, "fill": True},
            )
            document_id = created.json()["id"]
            client.post(
                f"/stock/inventory/{document_id}/counted",
                json={"nomenclature_id": product_id, "counted_qty": "7.000"},
            )
            client.post(
                "/stock/documents",
                json={
                    "doc_type": "receipt",
                    "warehouse_id": warehouse_id,
                    "lines": [
                        {"nomenclature_id": product_id, "quantity": "3.000"}
                    ],
                    "post": True,
                },
            )
            refreshed = client.post(f"/stock/inventory/{document_id}/refresh")
            assert refreshed.status_code == 200, refreshed.text
            line = refreshed.json()["inventory_lines"][0]
            assert Decimal(line["book_qty"]) == Decimal("13.000")
            assert Decimal(line["counted_qty"]) == Decimal("7.000")
            assert Decimal(line["delta"]) == Decimal("-6.000")
    finally:
        app.dependency_overrides.pop(get_db, None)
