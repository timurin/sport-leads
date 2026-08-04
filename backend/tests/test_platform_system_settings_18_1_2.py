"""Stage 18.1.2 — platform system settings singleton API."""

from __future__ import annotations

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.database.base import Base
from app.database.session import get_db
from app.main import app
from app.services.auth import create_platform_user
from app.services import rbac as rbac_service
from tests.auth_test_helpers import ensure_user_with_role, login_client


def _session_factory() -> sessionmaker[Session]:
    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine, expire_on_commit=False)


def test_platform_system_settings_get_requires_auth() -> None:
    factory = _session_factory()

    def override_get_db():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with TestClient(app) as client:
            response = client.get("/platform-system-settings")
            assert response.status_code == 401, response.text
    finally:
        app.dependency_overrides.pop(get_db, None)


def test_platform_system_settings_read_and_update_as_admin() -> None:
    factory = _session_factory()

    def override_get_db():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with factory() as db:
            user = create_platform_user(
                db,
                login="admin",
                password="secret-pass",
                display_name="Admin",
            )
            rbac_service.ensure_admin_role_for_user(db, user)

        with TestClient(app) as client:
            login_client(client, login="admin")
            get_response = client.get("/platform-system-settings")
            assert get_response.status_code == 200, get_response.text
            body = get_response.json()
            assert body["id"] == 1
            assert body["organization_display_name"] == "Sport-Lead"
            assert body["default_timezone"] == "Europe/Moscow"
            assert body["ui_locale"] == "ru-RU"

            put_response = client.put(
                "/platform-system-settings",
                json={
                    "organization_display_name": "Sport Lead Demo",
                    "default_timezone": "UTC",
                    "support_email": "ops@example.com",
                    "ui_locale": "en-US",
                    "notes": "Demo install",
                },
            )
            assert put_response.status_code == 200, put_response.text
            updated = put_response.json()
            assert updated["organization_display_name"] == "Sport Lead Demo"
            assert updated["default_timezone"] == "UTC"
            assert updated["support_email"] == "ops@example.com"
            assert updated["ui_locale"] == "en-US"
            assert updated["notes"] == "Demo install"

            reload = client.get("/platform-system-settings")
            assert reload.status_code == 200
            assert reload.json()["organization_display_name"] == "Sport Lead Demo"
    finally:
        app.dependency_overrides.pop(get_db, None)


def test_platform_system_settings_put_forbidden_without_permission() -> None:
    factory = _session_factory()

    def override_get_db():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with factory() as db:
            ensure_user_with_role(
                db,
                login="editor",
                role_code="catalog_editor",
            )

        with TestClient(app) as client:
            login_client(client, login="editor")
            get_response = client.get("/platform-system-settings")
            assert get_response.status_code == 200, get_response.text

            put_response = client.put(
                "/platform-system-settings",
                json={
                    "organization_display_name": "Blocked",
                    "default_timezone": "UTC",
                    "support_email": None,
                    "ui_locale": "ru-RU",
                    "notes": None,
                },
            )
            assert put_response.status_code == 403, put_response.text
    finally:
        app.dependency_overrides.pop(get_db, None)


def test_platform_system_settings_logo_upload_and_content() -> None:
    factory = _session_factory()

    def override_get_db():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with factory() as db:
            user = create_platform_user(
                db,
                login="admin",
                password="secret-pass",
                display_name="Admin",
            )
            rbac_service.ensure_admin_role_for_user(db, user)

        png = (
            b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01"
            b"\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00\x00"
            b"\x00\x0cIDATx\x9cc\xf8\x0f\x00\x00\x01\x01\x00\x05\x18"
            b"\xd8N\x00\x00\x00\x00IEND\xaeB`\x82"
        )
        with TestClient(app) as client:
            login_client(client, login="admin")
            upload = client.post(
                "/platform-system-settings/logo",
                files={"file": ("logo.png", png, "image/png")},
            )
            assert upload.status_code == 200, upload.text
            body = upload.json()
            assert body["logo_url"] == "/platform-system-settings/logo/content"
            assert body["logo_filename"] == "logo.png"

            content = client.get("/platform-system-settings/logo/content")
            assert content.status_code == 200, content.text
            assert content.content.startswith(b"\x89PNG")

            brand = client.get("/platform-system-settings/brand")
            assert brand.status_code == 200
            assert brand.json()["logo_url"] == "/platform-system-settings/logo/content"

            cleared = client.delete("/platform-system-settings/logo")
            assert cleared.status_code == 200, cleared.text
            assert cleared.json()["logo_url"] is None
            assert (
                client.get("/platform-system-settings/logo/content").status_code == 404
            )
    finally:
        app.dependency_overrides.pop(get_db, None)
