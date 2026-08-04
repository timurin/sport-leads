"""Stage 18.2.2 — platform directories registry + cities CRUD."""

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


def test_platform_directories_registry_and_cities_crud() -> None:
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
            registry = client.get("/platform-directories")
            assert registry.status_code == 200, registry.text
            codes = {item["code"] for item in registry.json()}
            assert "cities" in codes

            created = client.post(
                "/platform-directories/cities",
                json={
                    "name": "Тверь",
                    "region": "Тверская область",
                    "is_active": True,
                    "sort_order": 5,
                },
            )
            assert created.status_code == 201, created.text
            city_id = created.json()["id"]
            assert created.json()["name"] == "Тверь"

            listed = client.get("/platform-directories/cities")
            assert listed.status_code == 200
            assert any(row["id"] == city_id for row in listed.json())

            patched = client.patch(
                f"/platform-directories/cities/{city_id}",
                json={"is_active": False},
            )
            assert patched.status_code == 200, patched.text
            assert patched.json()["is_active"] is False

            deleted = client.delete(f"/platform-directories/cities/{city_id}")
            assert deleted.status_code == 204, deleted.text
            assert (
                client.get(f"/platform-directories/cities/{city_id}").status_code
                == 404
            )
    finally:
        app.dependency_overrides.pop(get_db, None)


def test_platform_cities_write_forbidden_without_permission() -> None:
    factory = _session_factory()

    def override_get_db():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with factory() as db:
            ensure_user_with_role(db, login="editor", role_code="catalog_editor")

        with TestClient(app) as client:
            login_client(client, login="editor")
            response = client.post(
                "/platform-directories/cities",
                json={"name": "Blocked"},
            )
            assert response.status_code == 403, response.text
    finally:
        app.dependency_overrides.pop(get_db, None)
