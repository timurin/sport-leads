"""Stage 21.2.2 — platform user list filter + invite API."""

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


def _session_factory() -> sessionmaker[Session]:
    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine, expire_on_commit=False)


def test_invite_and_list_filters() -> None:
    factory = _session_factory()

    def override_get_db():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with factory() as db:
            rbac_service.ensure_rbac_seed(db)
            admin = create_platform_user(
                db,
                login="admin",
                password="secret-pass",
                display_name="Admin",
                department="IT",
                email="admin@example.com",
            )
            rbac_service.ensure_admin_role_for_user(db, admin)
            create_platform_user(
                db,
                login="dormant",
                password="secret-pass",
                display_name="Dormant",
                is_active=False,
            )

        with TestClient(app) as client:
            login = client.post(
                "/auth/login",
                json={"login": "admin", "password": "secret-pass"},
            )
            assert login.status_code == 200, login.text
            me = login.json()["user"]
            assert me["invite_status"] == "active"
            assert me["last_activity_at"] is not None
            assert me["department"] == "IT"

            invited = client.post(
                "/platform-users/invite",
                json={
                    "login": "newbie",
                    "display_name": "Новый",
                    "email": "new@example.com",
                    "phone": "+79990001122",
                    "department": "Sales",
                    "role_codes": ["catalog_editor"],
                },
            )
            assert invited.status_code == 201, invited.text
            body = invited.json()
            assert body["temporary_password"]
            user = body["user"]
            assert user["login"] == "newbie"
            assert user["invite_status"] == "invited"
            assert user["email"] == "new@example.com"
            assert user["department"] == "Sales"
            assert "catalog_editor" in user["roles"]
            temp_password = body["temporary_password"]

            by_q = client.get("/platform-users", params={"q": "Sales"})
            assert by_q.status_code == 200, by_q.text
            logins = {item["login"] for item in by_q.json()["items"]}
            assert logins == {"newbie"}

            invited_only = client.get(
                "/platform-users", params={"status": "invited"}
            )
            assert invited_only.status_code == 200
            assert {item["login"] for item in invited_only.json()["items"]} == {
                "newbie"
            }

            inactive = client.get(
                "/platform-users", params={"status": "inactive"}
            )
            assert {item["login"] for item in inactive.json()["items"]} == {
                "dormant"
            }

            active = client.get("/platform-users", params={"status": "active"})
            assert {item["login"] for item in active.json()["items"]} == {
                "admin"
            }

            accept = client.post(
                "/auth/login",
                json={"login": "newbie", "password": temp_password},
            )
            assert accept.status_code == 200, accept.text
            assert accept.json()["user"]["invite_status"] == "active"
            assert accept.json()["user"]["last_activity_at"] is not None

            # Switch back to admin session for list after invite acceptance.
            client.post(
                "/auth/login",
                json={"login": "admin", "password": "secret-pass"},
            )
            invited_after = client.get(
                "/platform-users", params={"status": "invited"}
            )
            assert invited_after.json()["items"] == []

            dup = client.post(
                "/platform-users/invite",
                json={"login": "newbie", "display_name": "Dup"},
            )
            assert dup.status_code == 422
    finally:
        app.dependency_overrides.pop(get_db, None)
