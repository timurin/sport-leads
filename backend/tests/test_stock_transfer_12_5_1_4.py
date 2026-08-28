"""Stage 12.5.1.4 — transfer HTTP API (ADR-019)."""

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
    db.commit()
    return source.id, dest.id, product.id


def _bind(factory: sessionmaker[Session]) -> None:
    def override_get_db():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db


def test_transfer_api_create_line_post_and_slim_list() -> None:
    factory = _session_factory()
    _bind(factory)
    try:
        with factory() as db:
            source_id, dest_id, product_id = _seed(db)

        with TestClient(app) as client:
            receipt = client.post(
                "/stock/documents",
                json={
                    "doc_type": "receipt",
                    "warehouse_id": source_id,
                    "lines": [
                        {"nomenclature_id": product_id, "quantity": "10.000"}
                    ],
                    "post": True,
                },
            )
            assert receipt.status_code == 201, receipt.text

            created = client.post(
                "/stock/transfers",
                json={
                    "warehouse_id": source_id,
                    "destination_warehouse_id": dest_id,
                    "lines": [
                        {"nomenclature_id": product_id, "quantity": "3.000"}
                    ],
                },
            )
            assert created.status_code == 201, created.text
            body = created.json()
            assert body["doc_type"] == "transfer"
            assert body["status"] == "draft"
            assert body["number"].startswith("STK-")
            assert body["warehouse_id"] == source_id
            assert body["destination_warehouse_id"] == dest_id
            assert body["ledger_lines"] == []
            assert len(body["transfer_lines"]) == 1
            line = body["transfer_lines"][0]
            assert line["nomenclature_id"] == product_id
            assert line["nomenclature_name"] == "Футболка PRO"
            assert Decimal(line["quantity"]) == Decimal("3.000")

            document_id = body["id"]
            updated = client.post(
                f"/stock/transfers/{document_id}/lines",
                json={"nomenclature_id": product_id, "quantity": "4.000"},
            )
            assert updated.status_code == 200, updated.text
            assert Decimal(updated.json()["transfer_lines"][0]["quantity"]) == Decimal(
                "4.000"
            )

            posted = client.post(f"/stock/transfers/{document_id}/post")
            assert posted.status_code == 200, posted.text
            assert posted.json()["status"] == "posted"
            ledger = posted.json()["ledger_lines"]
            assert len(ledger) == 2
            qtys = {row["warehouse_id"]: Decimal(row["quantity"]) for row in ledger}
            assert qtys[source_id] == Decimal("-4.000")
            assert qtys[dest_id] == Decimal("4.000")

            detail = client.get(f"/stock/documents/{document_id}")
            assert detail.status_code == 200, detail.text
            assert len(detail.json()["transfer_lines"]) == 1
            assert detail.json()["destination_warehouse_id"] == dest_id

            listed = client.get(
                "/stock/documents", params={"doc_type": "transfer"}
            )
            assert listed.status_code == 200, listed.text
            rows = listed.json()
            assert len(rows) == 1
            assert rows[0]["id"] == document_id
            assert rows[0]["doc_type"] == "transfer"
            assert rows[0]["transfer_lines"] == []
            assert rows[0]["destination_warehouse_id"] == dest_id

            dest_list = client.get(
                "/stock/documents", params={"warehouse_id": dest_id}
            )
            assert dest_list.status_code == 200
            assert any(row["id"] == document_id for row in dest_list.json())

            source_bal = client.get(
                "/stock/balances",
                params={
                    "warehouse_id": source_id,
                    "nomenclature_id": product_id,
                },
            )
            dest_bal = client.get(
                "/stock/balances",
                params={
                    "warehouse_id": dest_id,
                    "nomenclature_id": product_id,
                },
            )
            assert source_bal.status_code == 200
            assert dest_bal.status_code == 200
            assert Decimal(source_bal.json()[0]["quantity"]) == Decimal("6.000")
            assert Decimal(dest_bal.json()[0]["quantity"]) == Decimal("4.000")
    finally:
        app.dependency_overrides.pop(get_db, None)


def test_transfer_api_rejects_same_warehouse_and_movement_post() -> None:
    factory = _session_factory()
    _bind(factory)
    try:
        with factory() as db:
            source_id, dest_id, product_id = _seed(db)

        with TestClient(app) as client:
            same = client.post(
                "/stock/transfers",
                json={
                    "warehouse_id": source_id,
                    "destination_warehouse_id": source_id,
                },
            )
            assert same.status_code == 422, same.text

            created = client.post(
                "/stock/transfers",
                json={
                    "warehouse_id": source_id,
                    "destination_warehouse_id": dest_id,
                    "lines": [
                        {"nomenclature_id": product_id, "quantity": "1.000"}
                    ],
                },
            )
            assert created.status_code == 201, created.text
            document_id = created.json()["id"]

            movement_post = client.post(f"/stock/documents/{document_id}/post")
            assert movement_post.status_code == 422, movement_post.text

            first = client.post(f"/stock/transfers/{document_id}/post")
            assert first.status_code == 200, first.text
            second = client.post(f"/stock/transfers/{document_id}/post")
            assert second.status_code == 422, second.text
    finally:
        app.dependency_overrides.pop(get_db, None)


def test_transfer_api_remove_line() -> None:
    factory = _session_factory()
    _bind(factory)
    try:
        with factory() as db:
            source_id, dest_id, product_id = _seed(db)

        with TestClient(app) as client:
            created = client.post(
                "/stock/transfers",
                json={
                    "warehouse_id": source_id,
                    "destination_warehouse_id": dest_id,
                    "lines": [
                        {"nomenclature_id": product_id, "quantity": "1.000"}
                    ],
                },
            )
            document_id = created.json()["id"]
            removed = client.delete(
                f"/stock/transfers/{document_id}/lines/{product_id}"
            )
            assert removed.status_code == 200, removed.text
            assert removed.json()["transfer_lines"] == []
    finally:
        app.dependency_overrides.pop(get_db, None)
