"""Stage 28.5.1 — convert standalone tech card (B) onto a free SalesOrderItem (A)."""

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
from app.models.sales import Lead, LeadTask, SalesUser
from app.models.technical_card import TechnicalCard


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


def _add_nomenclature(
    session_factory: sessionmaker[Session],
    *,
    name: str = "Футболка PRO",
) -> int:
    with session_factory() as db:
        row = Nomenclature(
            name=name,
            category="Форма",
            nomenclature_type=NomenclatureType.PRODUCT,
            unit="шт",
            base_price=Decimal("1500.00"),
        )
        db.add(row)
        db.commit()
        return row.id


def _add_lead(session_factory: sessionmaker[Session]) -> int:
    with session_factory() as db:
        lead = Lead(
            contact_name="Иван Петров",
            company_name="СК Олимп",
            phone="+79990000000",
            email="sales@example.com",
            city="Казань",
            source="website",
            responsible_id=1,
            sport="Футбол",
            product_category="Форма",
            need_description="Форма для команды",
            estimated_quantity=25,
            estimated_amount=Decimal("250000"),
        )
        db.add(lead)
        db.flush()
        db.add(LeadTask(lead_id=lead.id, title="Позвонить клиенту"))
        db.commit()
        return lead.id


def _convert_order(client: TestClient, session_factory: sessionmaker[Session]) -> int:
    lead_id = _add_lead(session_factory)
    return client.post(
        f"/leads/{lead_id}/convert",
        json={"completed_by_id": 1},
    ).json()["order"]["id"]


def _add_item(
    client: TestClient,
    order_id: int,
    nomenclature_id: int,
    *,
    snapshot_name: str = "Футболка PRO",
    quantity: str = "2",
) -> int:
    created = client.post(
        f"/orders/{order_id}/items",
        json={
            "nomenclature_id": nomenclature_id,
            "snapshot_name": snapshot_name,
            "unit": "шт",
            "quantity": quantity,
            "unit_price": "1500",
        },
    )
    assert created.status_code == 201, created.text
    return created.json()["id"]


def _create_standalone(
    client: TestClient,
    nomenclature_id: int,
    **overrides: object,
) -> dict:
    body: dict[str, object] = {
        "nomenclature_id": nomenclature_id,
        "order_number": "1310",
        "tech_cards_planned_count": 5,
        "desired_date": "2026-09-15",
        "quantity": 3,
    }
    body.update(overrides)
    created = client.post("/technical-cards/standalone", json=body)
    assert created.status_code == 201, created.text
    return created.json()


def test_link_standalone_sets_sales_order_keeps_number(
    client: TestClient, session_factory: sessionmaker[Session]
) -> None:
    nomenclature_id = _add_nomenclature(session_factory)
    standalone = _create_standalone(client, nomenclature_id)
    stored_number = standalone["number"]
    unit_count = len(standalone["unit_lines"])
    assert stored_number == "1310-1"
    assert standalone["display_number"] == "1310-1/5"
    assert standalone["sales_order_id"] is None

    order_id = _convert_order(client, session_factory)
    item_id = _add_item(client, order_id, nomenclature_id)
    planned = client.patch(
        f"/orders/{order_id}/tech-cards-planned-count",
        json={"tech_cards_planned_count": 9},
    )
    assert planned.status_code == 200, planned.text

    linked = client.post(
        f"/technical-cards/{standalone['id']}/link-sales-order-item",
        json={"sales_order_item_id": item_id},
    )
    assert linked.status_code == 200, linked.text
    body = linked.json()
    assert body["number"] == stored_number
    assert body["display_number"] == "1310-1/9"
    assert body["sales_order_id"] == order_id
    assert body["sales_order_item_id"] == item_id
    assert body["order_group_id"] is None
    assert body["card_seq"] == 1
    assert len(body["unit_lines"]) == unit_count

    with session_factory() as db:
        row = db.get(TechnicalCard, standalone["id"])
        assert row is not None
        assert row.number == stored_number
        assert row.sales_order_id == order_id
        assert row.sales_order_item_id == item_id
        assert row.order_group_id is None

    generated = client.post(f"/orders/{order_id}/technical-cards/generate")
    assert generated.status_code == 201, generated.text
    gen = generated.json()
    assert gen["created"] == []
    assert any(
        row["reason"] == "card_exists" and row["sales_order_item_id"] == item_id
        for row in gen["skipped"]
    )


def test_link_standalone_occupied_item_conflict(
    client: TestClient, session_factory: sessionmaker[Session]
) -> None:
    nomenclature_id = _add_nomenclature(session_factory)
    order_id = _convert_order(client, session_factory)
    item_id = _add_item(client, order_id, nomenclature_id)
    generated = client.post(f"/orders/{order_id}/technical-cards/generate")
    assert generated.status_code == 201, generated.text
    assert len(generated.json()["created"]) == 1

    standalone = _create_standalone(client, nomenclature_id)
    conflict = client.post(
        f"/technical-cards/{standalone['id']}/link-sales-order-item",
        json={"sales_order_item_id": item_id},
    )
    assert conflict.status_code == 409, conflict.text
    assert "уже есть техкарта" in conflict.json()["detail"]


def test_link_already_bound_card_rejected(
    client: TestClient, session_factory: sessionmaker[Session]
) -> None:
    nomenclature_id = _add_nomenclature(session_factory)
    order_id = _convert_order(client, session_factory)
    item_id = _add_item(client, order_id, nomenclature_id)
    generated = client.post(f"/orders/{order_id}/technical-cards/generate")
    card_id = generated.json()["created"][0]["id"]

    rejected = client.post(
        f"/technical-cards/{card_id}/link-sales-order-item",
        json={"sales_order_item_id": item_id},
    )
    assert rejected.status_code == 422, rejected.text
    assert "уже привязана" in rejected.json()["detail"]


def test_link_nomenclature_mismatch_rejected(
    client: TestClient, session_factory: sessionmaker[Session]
) -> None:
    shirt_id = _add_nomenclature(session_factory, name="Футболка PRO")
    shorts_id = _add_nomenclature(session_factory, name="Шорты PRO")
    standalone = _create_standalone(client, shirt_id)
    order_id = _convert_order(client, session_factory)
    item_id = _add_item(
        client, order_id, shorts_id, snapshot_name="Шорты PRO"
    )

    mismatch = client.post(
        f"/technical-cards/{standalone['id']}/link-sales-order-item",
        json={"sales_order_item_id": item_id},
    )
    assert mismatch.status_code == 422, mismatch.text
    assert "не совпадает" in mismatch.json()["detail"]


def test_link_missing_item_not_found(
    client: TestClient, session_factory: sessionmaker[Session]
) -> None:
    nomenclature_id = _add_nomenclature(session_factory)
    standalone = _create_standalone(client, nomenclature_id)
    missing = client.post(
        f"/technical-cards/{standalone['id']}/link-sales-order-item",
        json={"sales_order_item_id": 999_999},
    )
    assert missing.status_code == 404
