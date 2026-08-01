"""Stage 4.4.5 — nomenclature non-image attachments."""

from __future__ import annotations

import base64

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.database.base import Base
from app.database.session import get_db
from app.main import app
from app.models.media import NomenclatureMedia  # noqa: F401
from app.models.nomenclature import NomenclatureHistoryEntry  # noqa: F401


@pytest.fixture()
def session_factory() -> sessionmaker[Session]:
    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, expire_on_commit=False)
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


def test_nomenclature_accepts_pdf_attachment(client: TestClient) -> None:
    created = client.post(
        "/nomenclatures",
        json={"name": "With PDF", "category": "docs"},
    )
    assert created.status_code == 201, created.text
    item_id = created.json()["id"]
    payload = {
        "filename": "spec.pdf",
        "mime_type": "application/pdf",
        "content_base64": base64.b64encode(b"%PDF-1.4 demo").decode("ascii"),
        "is_primary": True,
    }
    media = client.post(f"/nomenclatures/{item_id}/media", json=payload)
    assert media.status_code == 201, media.text
    body = media.json()
    assert body["mime_type"] == "application/pdf"
    assert body["is_primary"] is False
    assert body["filename"] == "spec.pdf"

    content = client.get(body["content_url"])
    assert content.status_code == 200
    assert content.content.startswith(b"%PDF")

    history = client.get(f"/nomenclatures/{item_id}/history").json()
    assert any("файл" in row["action"] for row in history)


def test_nomenclature_rejects_exe_and_primary_on_file(client: TestClient) -> None:
    created = client.post(
        "/nomenclatures",
        json={"name": "Reject EXE", "category": "docs"},
    )
    assert created.status_code == 201, created.text
    item_id = created.json()["id"]
    content = base64.b64encode(b"hello").decode("ascii")

    invalid = client.post(
        f"/nomenclatures/{item_id}/media",
        json={
            "filename": "bad.exe",
            "mime_type": "application/octet-stream",
            "content_base64": content,
        },
    )
    assert invalid.status_code == 422

    pdf = client.post(
        f"/nomenclatures/{item_id}/media",
        json={
            "filename": "note.pdf",
            "mime_type": "application/pdf",
            "content_base64": content,
            "is_primary": False,
        },
    )
    assert pdf.status_code == 201, pdf.text
    media_id = pdf.json()["id"]
    primary = client.patch(
        f"/nomenclatures/{item_id}/media/{media_id}",
        json={"is_primary": True},
    )
    assert primary.status_code == 422
