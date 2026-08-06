"""v1.00 / 20.4.2 — order client-need PATCH + optional lead sync."""

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
    SalesOrder,
    SalesOrderStatus,
    SalesUser,
)
from tests.auth_test_helpers import ensure_user_with_role, login_client


def _session_factory() -> sessionmaker[Session]:
    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine, expire_on_commit=False)


def test_order_client_need_patch_syncs_lead() -> None:
    SessionLocal = _session_factory()
    db = SessionLocal()
    sales_user = SalesUser(id=1, name="Test")
    db.add(sales_user)
    db.flush()
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
        need_description="Старое",
        estimated_quantity=1,
        estimated_amount=Decimal("1000"),
    )
    db.add(lead)
    db.flush()
    order = SalesOrder(
        number="SO-NEED-1",
        lead_id=lead.id,
        client_id=client.id,
        status=SalesOrderStatus.NEW,
        title="Заказ",
        responsible_id=1,
        sport="Футбол",
        product_category="Форма",
        description="Старое",
        quantity=1,
    )
    db.add(order)
    db.flush()
    order_id = order.id
    lead_id = lead.id
    ensure_user_with_role(db, login="admin", role_code="admin")
    db.commit()
    db.close()

    def override_get_db():
        session = SessionLocal()
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_db] = override_get_db
    try:
        with TestClient(app) as http:
            login_client(http, login="admin")
            patched = http.patch(
                f"/orders/{order_id}/client-need",
                json={
                    "sport": "Хоккей",
                    "product_category": "Игровая форма",
                    "quantity": 12,
                    "description": "Новая потребность",
                    "source": "call",
                    "desired_date": "2026-09-01",
                    "sync_to_lead": True,
                },
            )
            assert patched.status_code == 200, patched.text
            body = patched.json()
            assert body["sport"] == "Хоккей"
            assert body["product_category"] == "Игровая форма"
            assert body["quantity"] == 12
            assert body["description"] == "Новая потребность"
            assert body["desired_date"] == "2026-09-01"

        with SessionLocal() as check:
            lead_row = check.get(Lead, lead_id)
            assert lead_row is not None
            assert lead_row.sport == "Хоккей"
            assert lead_row.product_category == "Игровая форма"
            assert lead_row.estimated_quantity == 12
            assert lead_row.need_description == "Новая потребность"
            assert lead_row.source == "call"
            assert str(lead_row.desired_date) == "2026-09-01"
    finally:
        app.dependency_overrides.clear()
