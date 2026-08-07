"""Stage 20.3.2 — lead collaboration thread XOR (ADR-027)."""

from __future__ import annotations

from decimal import Decimal

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.database.base import Base
from app.database.session import get_db
from app.main import app
from app.models.sales import Lead, SalesUser
from tests.auth_test_helpers import ensure_user_with_role, login_client


def _session_factory() -> sessionmaker[Session]:
    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine, expire_on_commit=False)


def _seed_lead(db: Session) -> int:
    sales_user = db.get(SalesUser, 1)
    if sales_user is None:
        sales_user = SalesUser(id=1, name="Test")
        db.add(sales_user)
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
    return lead.id


def test_lead_collaboration_message_and_microtask_roundtrip() -> None:
    SessionLocal = _session_factory()
    db = SessionLocal()
    lead_id = _seed_lead(db)
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
        empty = client.get(f"/leads/{lead_id}/collaboration/messages")
        assert empty.status_code == 200
        assert empty.json() == []

        created = client.post(
            f"/leads/{lead_id}/collaboration/messages",
            json={"body": "Нужна правка макета @mgr"},
        )
        assert created.status_code == 201, created.text
        body = created.json()
        assert body["lead_id"] == lead_id
        assert body["sales_order_id"] is None
        assert body["body"].startswith("Нужна")

        listed = client.get(f"/leads/{lead_id}/collaboration/messages")
        assert listed.status_code == 200
        assert len(listed.json()) == 1

        cand = client.get("/collaboration/mention-candidates")
        assert cand.status_code == 200
        assignee_id = next(row["id"] for row in cand.json() if row["login"] == "mgr")

        task = client.post(
            f"/leads/{lead_id}/collaboration/microtasks",
            json={
                "title": "Правка по макету",
                "assignee_platform_user_id": assignee_id,
                "source_message_id": body["id"],
            },
        )
        assert task.status_code == 201, task.text
        task_body = task.json()
        assert task_body["lead_id"] == lead_id
        assert task_body["sales_order_id"] is None

        reject_tc = client.post(
            f"/leads/{lead_id}/collaboration/messages",
            json={"body": "x", "technical_card_id": 1},
        )
        assert reject_tc.status_code == 422
    finally:
        app.dependency_overrides.clear()
