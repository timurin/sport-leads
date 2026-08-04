"""Stage 10.1.2.3 — DesignVersion assets + comments API (ADR-022)."""

from __future__ import annotations

import base64
from decimal import Decimal
from pathlib import Path

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
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
    SalesOrderStatus,
    SalesUser,
)
from app.services import design_version_assets as assets_svc


def _session_factory() -> sessionmaker[Session]:
    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    with engine.begin() as conn:
        conn.execute(
            text(
                "CREATE UNIQUE INDEX IF NOT EXISTS uq_design_versions_one_current "
                "ON design_versions (design_project_id) WHERE status = 'current'"
            )
        )
        conn.execute(
            text(
                "CREATE UNIQUE INDEX IF NOT EXISTS uq_design_version_assets_one_primary "
                "ON design_version_assets (design_version_id) WHERE is_primary = 1"
            )
        )
    return sessionmaker(bind=engine, expire_on_commit=False)


def _seed_order(db: Session) -> int:
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
        estimated_quantity=1,
        estimated_amount=Decimal("1000"),
    )
    db.add(lead)
    db.flush()
    db.add(LeadTask(lead_id=lead.id, title="Задача"))
    order = SalesOrder(
        number="SO-ASSET-API",
        lead_id=lead.id,
        client_id=client.id,
        status=SalesOrderStatus.NEW,
        title="Assets API",
        responsible_id=1,
    )
    db.add(order)
    db.commit()
    return order.id


def test_design_assets_and_comments_api(tmp_path: Path, monkeypatch) -> None:
    media_root = tmp_path / "design-version-media"
    media_root.mkdir()
    monkeypatch.setattr(assets_svc, "MEDIA_ROOT", media_root.resolve())

    factory = _session_factory()

    def override_get_db():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with factory() as db:
            order_id = _seed_order(db)

        with TestClient(app) as client:
            project = client.post(
                "/design-projects",
                json={"sales_order_id": order_id, "title": "Макет"},
            )
            assert project.status_code == 201, project.text
            project_id = project.json()["id"]

            version = client.post(
                f"/design-projects/{project_id}/versions",
                json={"make_current": True},
            )
            assert version.status_code == 201, version.text
            version_id = version.json()["id"]

            png = base64.b64encode(b"\x89PNG\r\n\x1a\nfake").decode("ascii")
            created = client.post(
                f"/design-projects/{project_id}/versions/{version_id}/assets",
                json={
                    "filename": "layout.png",
                    "mime_type": "image/png",
                    "content_base64": png,
                    "kind": "layout",
                    "is_primary": True,
                },
            )
            assert created.status_code == 201, created.text
            asset = created.json()
            assert asset["is_primary"] is True
            assert asset["kind"] == "layout"
            assert "/content" in asset["content_url"]
            asset_id = asset["id"]

            listed = client.get(
                f"/design-projects/{project_id}/versions/{version_id}/assets"
            )
            assert listed.status_code == 200
            assert len(listed.json()) == 1

            content = client.get(
                f"/design-projects/{project_id}/versions/{version_id}/assets/{asset_id}/content"
            )
            assert content.status_code == 200
            assert content.content.startswith(b"\x89PNG")

            comment = client.post(
                f"/design-projects/{project_id}/versions/{version_id}/comments",
                json={"body": "Проверить логотип", "author_name": "Дизайнер"},
            )
            assert comment.status_code == 201, comment.text
            comment_id = comment.json()["id"]

            comments = client.get(
                f"/design-projects/{project_id}/versions/{version_id}/comments"
            )
            assert comments.status_code == 200
            assert len(comments.json()) == 1

            deleted_comment = client.delete(
                f"/design-projects/{project_id}/versions/{version_id}/comments/{comment_id}"
            )
            assert deleted_comment.status_code == 204

            deleted_asset = client.delete(
                f"/design-projects/{project_id}/versions/{version_id}/assets/{asset_id}"
            )
            assert deleted_asset.status_code == 204
            assert (
                client.get(
                    f"/design-projects/{project_id}/versions/{version_id}/assets"
                ).json()
                == []
            )

            bad_mime = client.post(
                f"/design-projects/{project_id}/versions/{version_id}/assets",
                json={
                    "filename": "x.bin",
                    "mime_type": "application/octet-stream",
                    "content_base64": png,
                    "kind": "other",
                },
            )
            assert bad_mime.status_code == 422
    finally:
        app.dependency_overrides.clear()
