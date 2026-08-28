"""Stage 28.5.2 — ProductionOrder without SalesOrder (standalone order group)."""

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
from app.models.sales import (
    Client,
    Lead,
    LeadTask,
    SalesOrder,
    SalesOrderItem,
    SalesOrderStatus,
    SalesUser,
)
from app.models.technical_card import TechnicalCard, TechnicalCardStatus


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


def test_create_production_order_from_standalone_group_and_attach_card(
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
    assert group_id is not None

    created = client.post(
        "/production-orders",
        json={"order_group_id": group_id},
    )
    assert created.status_code == 201, created.text
    body = created.json()
    assert body["sales_order_id"] is None
    assert body["order_group_id"] == group_id
    assert body["sales_order_number"] == "1310"
    assert body["number"] == "PO-1310-1"
    assert body["order_seq"] == 1

    listed = client.get("/production-orders")
    assert listed.status_code == 200
    match = next(row for row in listed.json() if row["id"] == body["id"])
    assert match["sales_order_id"] is None
    assert match["order_group_id"] == group_id
    assert match["sales_order_number"] == "1310"

    batch = client.post(
        f"/production-orders/{body['id']}/batches",
        json={"technical_card_ids": [card["id"]]},
    )
    assert batch.status_code == 201, batch.text
    assert len(batch.json()["card_links"]) == 1
    assert batch.json()["card_links"][0]["technical_card_id"] == card["id"]

    cards = client.get("/technical-cards", params={"order_group_id": group_id})
    assert cards.status_code == 200
    assert [row["id"] for row in cards.json()] == [card["id"]]


def test_standalone_po_rejects_sales_order_card(
    client: TestClient, session_factory: sessionmaker[Session]
) -> None:
    nomenclature_id = _add_nomenclature(session_factory)
    standalone = client.post(
        "/technical-cards/standalone",
        json={
            "nomenclature_id": nomenclature_id,
            "order_number": "1310",
            "tech_cards_planned_count": 2,
            "desired_date": "2026-09-15",
            "quantity": 1,
        },
    ).json()

    with session_factory() as db:
        client_row = Client(contact_name="A", company_name="B", responsible_id=1)
        db.add(client_row)
        db.flush()
        lead = Lead(
            contact_name="Иван",
            company_name="СК",
            phone="+79990000000",
            email="a@example.com",
            city="Казань",
            source="website",
            responsible_id=1,
            sport="Футбол",
            product_category="Форма",
            need_description="Форма",
            estimated_quantity=1,
            estimated_amount=Decimal("1000"),
        )
        db.add(lead)
        db.flush()
        db.add(LeadTask(lead_id=lead.id, title="Задача"))
        order = SalesOrder(
            number="SO-A",
            lead_id=lead.id,
            client_id=client_row.id,
            status=SalesOrderStatus.NEW,
            title="Заказ",
            responsible_id=1,
        )
        db.add(order)
        db.flush()
        item = SalesOrderItem(
            order_id=order.id,
            position=1,
            snapshot_name="Изделие",
            quantity=Decimal("1"),
            unit_price=Decimal("100"),
            line_amount=Decimal("100"),
            discount_amount=Decimal("0"),
            unit="шт",
        )
        db.add(item)
        db.flush()
        so_card = TechnicalCard(
            sales_order_id=order.id,
            sales_order_item_id=item.id,
            number="SO-A-1",
            card_seq=1,
            status=TechnicalCardStatus.DRAFT,
            quantity=Decimal("1"),
            nomenclature_name="Изделие",
        )
        db.add(so_card)
        db.commit()
        so_card_id = so_card.id

    po = client.post(
        "/production-orders",
        json={"order_group_id": standalone["order_group_id"]},
    )
    assert po.status_code == 201, po.text
    batch = client.post(
        f"/production-orders/{po.json()['id']}/batches",
        json={"technical_card_ids": [so_card_id]},
    )
    assert batch.status_code == 422, batch.text
    assert "standalone-группы" in batch.json()["detail"]


def test_create_production_order_rejects_both_or_neither(client: TestClient) -> None:
    neither = client.post("/production-orders", json={})
    assert neither.status_code == 422
    both = client.post(
        "/production-orders",
        json={"sales_order_id": 1, "order_group_id": 1},
    )
    assert both.status_code == 422
