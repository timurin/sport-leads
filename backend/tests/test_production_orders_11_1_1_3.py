"""Stage 11.1.1.3 — ProductionOrder / ProductionBatch API."""

from __future__ import annotations

from decimal import Decimal

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.database.base import Base
from app.database.session import get_db
from app.main import app
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


def _session_factory() -> sessionmaker[Session]:
    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine, expire_on_commit=False)


def _seed(db: Session) -> tuple[int, int, int]:
    db.add(SalesUser(id=1, name="Test"))
    client = Client(contact_name="A", company_name="B", responsible_id=1)
    db.add(client)
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
        estimated_quantity=2,
        estimated_amount=Decimal("2000"),
    )
    db.add(lead)
    db.flush()
    db.add(LeadTask(lead_id=lead.id, title="Задача"))
    order = SalesOrder(
        number="SO-API-1",
        lead_id=lead.id,
        client_id=client.id,
        status=SalesOrderStatus.NEW,
        title="Заказ API",
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
    card = TechnicalCard(
        sales_order_id=order.id,
        sales_order_item_id=item.id,
        number="SO-API-1-01",
        card_seq=1,
        status=TechnicalCardStatus.DRAFT,
        quantity=Decimal("1"),
        nomenclature_name="Изделие",
    )
    db.add(card)
    db.commit()
    return order.id, card.id, item.id


def test_production_order_api_create_batch_attach_detach() -> None:
    factory = _session_factory()

    def override_get_db():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with factory() as db:
            sales_order_id, card_id, _ = _seed(db)

        with TestClient(app) as client:
            created = client.post(
                "/production-orders",
                json={"sales_order_id": sales_order_id},
            )
            assert created.status_code == 201, created.text
            body = created.json()
            assert body["number"] == "PO-SO-API-1-1"
            assert body["order_seq"] == 1
            assert body["status"] == "draft"
            order_id = body["id"]

            listed = client.get("/production-orders", params={"sales_order_id": sales_order_id})
            assert listed.status_code == 200
            assert len(listed.json()) == 1
            assert listed.json()[0]["batch_count"] == 0

            batch = client.post(
                f"/production-orders/{order_id}/batches",
                json={"technical_card_ids": [card_id]},
            )
            assert batch.status_code == 201, batch.text
            batch_body = batch.json()
            assert batch_body["number"] == "PO-SO-API-1-1-B1"
            assert len(batch_body["card_links"]) == 1
            assert batch_body["card_links"][0]["technical_card_id"] == card_id
            batch_id = batch_body["id"]

            detail = client.get(f"/production-orders/{order_id}")
            assert detail.status_code == 200
            assert len(detail.json()["batches"]) == 1

            detached = client.delete(f"/production-batches/{batch_id}/cards/{card_id}")
            assert detached.status_code == 200, detached.text
            assert detached.json()["card_links"] == []

            attached = client.post(
                f"/production-batches/{batch_id}/cards",
                json={"technical_card_id": card_id},
            )
            assert attached.status_code == 200, attached.text
            assert len(attached.json()["card_links"]) == 1

            conflict = client.post(
                f"/production-orders/{order_id}/batches",
                json={"technical_card_ids": [card_id]},
            )
            assert conflict.status_code == 409, conflict.text
    finally:
        app.dependency_overrides.clear()


def test_production_order_rejects_foreign_sales_order_card() -> None:
    factory = _session_factory()

    def override_get_db():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with factory() as db:
            sales_order_id, card_id, _ = _seed(db)
            lead2 = Lead(
                contact_name="Пётр",
                company_name="СК2",
                phone="+79990000001",
                email="b@example.com",
                city="Казань",
                source="website",
                responsible_id=1,
                sport="Футбол",
                product_category="Форма",
                need_description="Форма",
                estimated_quantity=1,
                estimated_amount=Decimal("500"),
            )
            db.add(lead2)
            db.flush()
            db.add(LeadTask(lead_id=lead2.id, title="Задача 2"))
            other = SalesOrder(
                number="SO-OTHER",
                lead_id=lead2.id,
                client_id=db.get(SalesOrder, sales_order_id).client_id,
                status=SalesOrderStatus.NEW,
                title="Другой",
                responsible_id=1,
            )
            db.add(other)
            db.commit()
            other_id = other.id

        with TestClient(app) as client:
            po = client.post("/production-orders", json={"sales_order_id": other_id})
            assert po.status_code == 201, po.text
            batch = client.post(
                f"/production-orders/{po.json()['id']}/batches",
                json={"technical_card_ids": [card_id]},
            )
            assert batch.status_code == 422, batch.text
    finally:
        app.dependency_overrides.clear()
