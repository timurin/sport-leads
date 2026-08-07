"""Stage 23.2.3 — WorkTask embed lists on lead / order / production-order."""

from __future__ import annotations

from decimal import Decimal

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.database.base import Base
from app.database.session import get_db
from app.main import app
from app.models.sales import Client, Lead, Organization, SalesOrder, SalesUser
from tests.auth_test_helpers import ensure_user_with_role, login_client


def _session_factory() -> sessionmaker[Session]:
    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine, expire_on_commit=False)


def _seed(db: Session) -> tuple[int, int]:
    if db.get(SalesUser, 1) is None:
        db.add(SalesUser(id=1, name="Test"))
        db.flush()
    client = Client(contact_name="Клиент", company_name="СК", responsible_id=1)
    org = Organization(name="ООО Тест")
    db.add_all([client, org])
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
    order = SalesOrder(
        number="SO-WT-1",
        lead_id=lead.id,
        client_id=client.id,
        organization_id=org.id,
        responsible_id=1,
        title="Заказ",
    )
    db.add(order)
    db.flush()
    return lead.id, order.id


def test_work_task_embed_lists_on_lead_and_order() -> None:
    SessionLocal = _session_factory()
    db = SessionLocal()
    lead_id, order_id = _seed(db)
    ensure_user_with_role(db, login="mgr", role_code="admin")
    db.commit()
    db.close()

    def override_get_db():
        session = SessionLocal()
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_db] = override_get_db
    client = TestClient(app)
    try:
        login_client(client, login="mgr")

        lead_empty = client.get(f"/leads/{lead_id}/work-tasks")
        assert lead_empty.status_code == 200, lead_empty.text
        assert lead_empty.json() == []

        created_lead = client.post(
            "/work-tasks",
            json={"title": "Лид задача", "lead_id": lead_id},
        )
        assert created_lead.status_code == 201, created_lead.text

        created_order = client.post(
            "/work-tasks",
            json={"title": "Заказ задача", "sales_order_id": order_id},
        )
        assert created_order.status_code == 201, created_order.text

        lead_list = client.get(f"/leads/{lead_id}/work-tasks")
        assert lead_list.status_code == 200
        assert len(lead_list.json()) == 1
        assert lead_list.json()[0]["title"] == "Лид задача"

        order_list = client.get(f"/orders/{order_id}/work-tasks")
        assert order_list.status_code == 200
        assert len(order_list.json()) == 1
        assert order_list.json()[0]["title"] == "Заказ задача"

        missing = client.get("/leads/999999/work-tasks")
        assert missing.status_code == 404
    finally:
        app.dependency_overrides.clear()
