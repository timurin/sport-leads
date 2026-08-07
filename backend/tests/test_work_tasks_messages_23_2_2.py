"""Stage 23.2.2 — WorkTask messages + image upload + download."""

from __future__ import annotations

from decimal import Decimal
from pathlib import Path

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


def test_work_task_messages_text_and_image_roundtrip(
    tmp_path: Path, monkeypatch
) -> None:
    monkeypatch.setattr(
        "app.services.work_task_media.TASK_MEDIA_ROOT",
        tmp_path.resolve(),
    )
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
        created = client.post(
            "/work-tasks",
            json={"title": "Чат задача", "lead_id": lead_id},
        )
        assert created.status_code == 201, created.text
        task_id = created.json()["id"]

        empty = client.get(f"/work-tasks/{task_id}/messages")
        assert empty.status_code == 200
        assert empty.json() == []

        text_msg = client.post(
            f"/work-tasks/{task_id}/messages",
            data={"body": "Нужна правка"},
        )
        assert text_msg.status_code == 201, text_msg.text
        assert text_msg.json()["body"] == "Нужна правка"
        assert text_msg.json()["author_display_name"]
        assert text_msg.json()["attachments"] == []

        png_bytes = (
            b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01"
            b"\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00\x00"
            b"\x00\x0cIDATx\x9cc\xf8\x0f\x00\x00\x01\x01\x00\x05\x18"
            b"\xd8N\x00\x00\x00\x00IEND\xaeB`\x82"
        )
        with_file = client.post(
            f"/work-tasks/{task_id}/messages",
            data={"body": "Скрин"},
            files={"file": ("shot.png", png_bytes, "image/png")},
        )
        assert with_file.status_code == 201, with_file.text
        payload = with_file.json()
        assert payload["body"] == "Скрин"
        assert len(payload["attachments"]) == 1
        attachment_id = payload["attachments"][0]["id"]
        assert payload["attachments"][0]["mime_type"] == "image/png"

        listed = client.get(f"/work-tasks/{task_id}/messages")
        assert listed.status_code == 200
        assert len(listed.json()) == 2

        downloaded = client.get(
            f"/work-tasks/{task_id}/attachments/{attachment_id}/file"
        )
        assert downloaded.status_code == 200
        assert downloaded.content == png_bytes
        assert "image/png" in downloaded.headers.get("content-type", "")

        bad_mime = client.post(
            f"/work-tasks/{task_id}/messages",
            data={"body": "pdf"},
            files={"file": ("a.pdf", b"%PDF-1.4", "application/pdf")},
        )
        assert bad_mime.status_code in {400, 415}, bad_mime.text
    finally:
        app.dependency_overrides.clear()
