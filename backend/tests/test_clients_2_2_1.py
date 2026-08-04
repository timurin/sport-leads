"""Stage 2.2.1 — GET /clients persistent list."""

from __future__ import annotations

from decimal import Decimal

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.database.base import Base
from app.database.session import get_db
from app.main import app
from app.models.sales import Client, Lead, SalesOrder, SalesOrderStatus, SalesUser


def _session_factory() -> sessionmaker[Session]:
    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine, expire_on_commit=False)


def test_list_clients_with_order_aggregates() -> None:
    SessionLocal = _session_factory()
    db = SessionLocal()
    db.add(SalesUser(id=1, name="Мария Иванова"))
    db.add(SalesUser(id=2, name="Пётр Сидоров"))
    db.flush()

    client_with_orders = Client(
        company_name="СК Олимп",
        contact_name="Иван Петров",
        phone="+79991112233",
        email="ivan@olymp.test",
        city="Казань",
        responsible_id=1,
    )
    client_empty = Client(
        company_name=None,
        contact_name="Анна Без заказов",
        phone="+79990001122",
        email=None,
        city="Москва",
        responsible_id=2,
    )
    db.add_all([client_with_orders, client_empty])
    db.flush()

    lead_a = Lead(
        contact_name="Иван Петров",
        company_name="СК Олимп",
        phone="+79991112233",
        email="ivan@olymp.test",
        city="Казань",
        source="website",
        responsible_id=1,
        sport="Футбол",
        product_category="Форма",
        need_description="Форма",
        estimated_quantity=10,
        estimated_amount=Decimal("50000"),
    )
    lead_b = Lead(
        contact_name="Иван Петров",
        company_name="СК Олимп",
        phone="+79991112233",
        email="ivan2@olymp.test",
        city="Казань",
        source="website",
        responsible_id=1,
        sport="Баскетбол",
        product_category="Форма",
        need_description="Резерв",
        estimated_quantity=5,
        estimated_amount=Decimal("20000"),
    )
    db.add_all([lead_a, lead_b])
    db.flush()

    db.add(
        SalesOrder(
            number="SO-CL-1",
            lead_id=lead_a.id,
            client_id=client_with_orders.id,
            status=SalesOrderStatus.NEW,
            title="Форма",
            sport="Футбол",
            amount=Decimal("12000.50"),
            responsible_id=1,
        )
    )
    db.add(
        SalesOrder(
            number="SO-CL-2",
            lead_id=lead_b.id,
            client_id=client_with_orders.id,
            status=SalesOrderStatus.CONFIRMED,
            title="Резерв",
            sport="Баскетбол",
            amount=Decimal("8000.00"),
            responsible_id=1,
        )
    )
    db.commit()

    def override_get_db():
        try:
            yield db
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    try:
        with TestClient(app) as client:
            response = client.get("/clients")
            assert response.status_code == 200
            body = response.json()
            assert len(body) == 2

            by_id = {row["id"]: row for row in body}
            rich = by_id[client_with_orders.id]
            assert rich["company_name"] == "СК Олимп"
            assert rich["contact_name"] == "Иван Петров"
            assert rich["responsible_name"] == "Мария Иванова"
            assert rich["orders_count"] == 2
            assert Decimal(str(rich["sales_amount"])) == Decimal("20000.50")
            assert rich["primary_sport"] in {"Футбол", "Баскетбол"}

            bare = by_id[client_empty.id]
            assert bare["company_name"] is None
            assert bare["orders_count"] == 0
            assert Decimal(str(bare["sales_amount"])) == Decimal("0")
            assert bare["responsible_name"] == "Пётр Сидоров"

            filtered = client.get("/clients", params={"q": "Олимп"})
            assert filtered.status_code == 200
            assert len(filtered.json()) == 1
            assert filtered.json()[0]["id"] == client_with_orders.id

            by_manager = client.get("/clients", params={"responsible_id": 2})
            assert by_manager.status_code == 200
            assert len(by_manager.json()) == 1
            assert by_manager.json()[0]["id"] == client_empty.id

            detail = client.get(f"/clients/{client_with_orders.id}")
            assert detail.status_code == 200
            detail_body = detail.json()
            assert detail_body["id"] == client_with_orders.id
            assert detail_body["orders_count"] == 2
            assert len(detail_body["recent_orders"]) == 2
            assert {row["number"] for row in detail_body["recent_orders"]} == {"SO-CL-1", "SO-CL-2"}

            missing = client.get("/clients/999999")
            assert missing.status_code == 404
    finally:
        app.dependency_overrides.pop(get_db, None)
        db.close()
