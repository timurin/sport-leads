"""Stage 17.1.1.2 — auth login/logout/me + opaque session cookie (ADR-023)."""

from __future__ import annotations

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.database.base import Base
from app.database.session import get_db
from app.main import app
from app.services.auth import SESSION_COOKIE_NAME, create_platform_user


def _session_factory() -> sessionmaker[Session]:
    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine, expire_on_commit=False)


def test_auth_login_me_logout_flow() -> None:
    factory = _session_factory()

    def override_get_db():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with factory() as db:
            create_platform_user(
                db,
                login="admin",
                password="secret-pass",
                display_name="Админ",
            )

        with TestClient(app) as client:
            denied = client.get("/auth/me")
            assert denied.status_code == 401

            bad = client.post(
                "/auth/login",
                json={"login": "admin", "password": "wrong"},
            )
            assert bad.status_code == 401

            ok = client.post(
                "/auth/login",
                json={"login": "Admin", "password": "secret-pass"},
            )
            assert ok.status_code == 200, ok.text
            body = ok.json()
            assert body["user"]["login"] == "admin"
            assert body["user"]["display_name"] == "Админ"
            assert body["user"]["sales_user_id"] is not None
            assert SESSION_COOKIE_NAME in client.cookies

            me = client.get("/auth/me")
            assert me.status_code == 200, me.text
            assert me.json()["id"] == body["user"]["id"]
            assert me.json()["sales_user_id"] == body["user"]["sales_user_id"]

            logout = client.post("/auth/logout")
            assert logout.status_code == 204

            after = client.get("/auth/me")
            assert after.status_code == 401
    finally:
        app.dependency_overrides.pop(get_db, None)


def test_inactive_user_cannot_login() -> None:
    factory = _session_factory()

    def override_get_db():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with factory() as db:
            create_platform_user(
                db,
                login="ghost",
                password="secret-pass",
                display_name="Ghost",
                is_active=False,
            )

        with TestClient(app) as client:
            response = client.post(
                "/auth/login",
                json={"login": "ghost", "password": "secret-pass"},
            )
            assert response.status_code == 401
    finally:
        app.dependency_overrides.pop(get_db, None)
