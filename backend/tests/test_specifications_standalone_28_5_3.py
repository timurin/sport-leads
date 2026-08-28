"""Stage 28.5.3 — Specification header without required SalesOrder."""

from __future__ import annotations

from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.database.base import Base
from app.database.session import get_db
from app.main import app
from app.models.characteristics import NomenclatureVariant  # noqa: F401
from app.models.media import NomenclatureMedia  # noqa: F401
from app.models.nomenclature import Nomenclature, NomenclatureHistoryEntry, NomenclatureType  # noqa: F401
from app.models.sales import SalesUser


@pytest.fixture()
def session_factory() -> sessionmaker[Session]:
    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, expire_on_commit=False)
    with factory() as db:
        db.add(SalesUser(id=1, name="Test user"))
        db.commit()
    yield factory
    Base.metadata.drop_all(engine)
    engine.dispose()


@pytest.fixture()
def client(session_factory: sessionmaker[Session]) -> TestClient:
    def override_get_db():
        with session_factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def _add_nomenclature(session_factory: sessionmaker[Session]) -> int:
    with session_factory() as db:
        row = Nomenclature(
            name="Футболка PRO",
            category="Форма",
            nomenclature_type=NomenclatureType.PRODUCT,
            unit="шт",
            base_price=Decimal("1500.00"),
        )
        db.add(row)
        db.commit()
        return row.id


def test_create_specification_from_standalone_production_order(
    client: TestClient, session_factory: sessionmaker[Session]
) -> None:
    nomenclature_id = _add_nomenclature(session_factory)
    created_card = client.post(
        "/technical-cards/standalone",
        json={
            "nomenclature_id": nomenclature_id,
            "order_number": "1310",
            "tech_cards_planned_count": 5,
            "desired_date": "2026-09-15",
            "quantity": 1,
        },
    )
    assert created_card.status_code == 201, created_card.text
    card = created_card.json()
    group_id = card["order_group_id"]

    created_po = client.post("/production-orders", json={"order_group_id": group_id})
    assert created_po.status_code == 201, created_po.text
    po = created_po.json()

    batch = client.post(
        f"/production-orders/{po['id']}/batches",
        json={"technical_card_ids": [card["id"]]},
    )
    assert batch.status_code == 201, batch.text
    batch_id = batch.json()["id"]

    created_spec = client.post(
        "/specifications",
        json={"production_batch_id": batch_id},
    )
    assert created_spec.status_code == 201, created_spec.text
    spec = created_spec.json()
    assert spec["sales_order_id"] is None
    assert spec["sales_order_number"] == "1310"
    assert spec["production_order_id"] == po["id"]
    assert spec["number"] == f"{batch.json()['number']}-SPEC"
    product_lines = spec["current_version"]["product_lines"]
    assert len(product_lines) == 1
    assert product_lines[0]["sales_order_item_id"] is None
    assert product_lines[0]["technical_card_id"] == card["id"]

    listed = client.get("/specifications", params={"search": "1310"})
    assert listed.status_code == 200
    match = next(row for row in listed.json() if row["id"] == spec["id"])
    assert match["sales_order_id"] is None
    assert match["sales_order_number"] == "1310"

    detail = client.get(f"/specifications/{spec['id']}")
    assert detail.status_code == 200
    assert detail.json()["sales_order_id"] is None
    assert detail.json()["sales_order_number"] == "1310"
