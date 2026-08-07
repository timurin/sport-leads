"""Stage 23.2.1 — WorkTask CRUD API /work-tasks."""

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
    if db.get(SalesUser, 1) is None:
        db.add(SalesUser(id=1, name="Test"))
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


def test_work_task_crud_roundtrip() -> None:
    SessionLocal = _session_factory()
    db = SessionLocal()
    lead_id = _seed_lead(db)
    user_id = ensure_user_with_role(db, login="mgr", role_code="admin")
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

        empty = client.get("/work-tasks")
        assert empty.status_code == 200, empty.text
        assert empty.json() == []

        bad = client.post(
            "/work-tasks",
            json={
                "title": "Dual",
                "lead_id": lead_id,
                "sales_order_id": 1,
            },
        )
        assert bad.status_code in {400, 422}, bad.text

        created = client.post(
            "/work-tasks",
            json={
                "title": "Правка макета",
                "lead_id": lead_id,
                "responsible_platform_user_id": user_id,
                "executor_platform_user_id": user_id,
            },
        )
        assert created.status_code == 201, created.text
        body = created.json()
        assert body["title"] == "Правка макета"
        assert body["status"] == "open"
        assert body["lead_id"] == lead_id
        assert body["sales_order_id"] is None
        task_id = body["id"]

        listed = client.get("/work-tasks")
        assert listed.status_code == 200
        assert len(listed.json()) == 1

        detail = client.get(f"/work-tasks/{task_id}")
        assert detail.status_code == 200
        assert detail.json()["id"] == task_id

        patched = client.patch(
            f"/work-tasks/{task_id}",
            json={"status": "in_progress", "title": "Правка v2"},
        )
        assert patched.status_code == 200, patched.text
        assert patched.json()["status"] == "in_progress"
        assert patched.json()["title"] == "Правка v2"

        missing = client.get("/work-tasks/999999")
        assert missing.status_code == 404
    finally:
        app.dependency_overrides.clear()
