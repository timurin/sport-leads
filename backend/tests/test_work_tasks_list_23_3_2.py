"""Stage 23.3.2 — WorkTask slim list DTO + filters (incl. anchor_type)."""

from __future__ import annotations

from decimal import Decimal

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.database.base import Base
from app.database.session import get_db
from app.main import app
from app.models.production_stage import ProductionStage
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


def _seed(db: Session) -> tuple[int, int, int, int]:
    if db.get(SalesUser, 1) is None:
        db.add(SalesUser(id=1, name="Test"))
        db.flush()
    stage = ProductionStage(name="Раскрой", code="cut", sort_order=1, is_active=True)
    db.add(stage)
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
        number="SO-LIST-1",
        lead_id=lead.id,
        client_id=client.id,
        organization_id=org.id,
        responsible_id=1,
        title="Заказ",
    )
    db.add(order)
    db.flush()
    return lead.id, order.id, stage.id, ensure_user_with_role(db, login="mgr", role_code="admin")


def test_work_task_list_filters_and_slim_embeds() -> None:
    SessionLocal = _session_factory()
    db = SessionLocal()
    lead_id, order_id, stage_id, user_id = _seed(db)
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

        lead_task = client.post(
            "/work-tasks",
            json={
                "title": "Лид задача",
                "lead_id": lead_id,
                "production_stage_id": stage_id,
                "responsible_platform_user_id": user_id,
                "executor_platform_user_id": user_id,
            },
        )
        assert lead_task.status_code == 201, lead_task.text

        order_task = client.post(
            "/work-tasks",
            json={
                "title": "Заказ задача",
                "sales_order_id": order_id,
                "status": "in_progress",
            },
        )
        assert order_task.status_code == 201, order_task.text

        all_rows = client.get("/work-tasks")
        assert all_rows.status_code == 200, all_rows.text
        body = all_rows.json()
        assert len(body) == 2
        lead_row = next(row for row in body if row["lead_id"] == lead_id)
        assert "completed_at" not in lead_row
        assert "messages" not in lead_row
        assert "attachments" not in lead_row
        assert lead_row["production_stage_name"] == "Раскрой"
        assert lead_row["responsible_display_name"]
        assert lead_row["executor_display_name"]

        by_status = client.get("/work-tasks", params={"status": "in_progress"})
        assert by_status.status_code == 200
        assert len(by_status.json()) == 1
        assert by_status.json()[0]["title"] == "Заказ задача"

        by_anchor = client.get("/work-tasks", params={"anchor_type": "lead"})
        assert by_anchor.status_code == 200
        assert len(by_anchor.json()) == 1
        assert by_anchor.json()[0]["lead_id"] == lead_id

        by_stage = client.get(
            "/work-tasks", params={"production_stage_id": stage_id}
        )
        assert by_stage.status_code == 200
        assert len(by_stage.json()) == 1

        by_user = client.get(
            "/work-tasks",
            params={"responsible_platform_user_id": user_id},
        )
        assert by_user.status_code == 200
        assert len(by_user.json()) == 1

        bad_anchor = client.get("/work-tasks", params={"anchor_type": "deal"})
        assert bad_anchor.status_code == 400
    finally:
        app.dependency_overrides.clear()
