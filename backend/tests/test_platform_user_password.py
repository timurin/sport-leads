"""Password change / admin set-password (cabinet Security)."""

from __future__ import annotations

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.database.base import Base
from app.database.session import get_db
from app.main import app
from app.models.auth import PlatformUser
from app.services.auth import create_platform_user, verify_password
from app.services import rbac as rbac_service


def _session_factory() -> sessionmaker[Session]:
    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine, expire_on_commit=False)


def test_change_own_password_and_admin_set_password() -> None:
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
            )
            rbac_service.ensure_admin_role_for_user(db, admin)
            target = create_platform_user(
                db,
                login="target",
                password="old-target-1",
                display_name="Target",
            )
            plain = create_platform_user(
                db,
                login="plain",
                password="plain-pass-1",
                display_name="Plain",
            )
            target_id = target.id

        with TestClient(app) as client:
            assert (
                client.post(
                    "/auth/login",
                    json={"login": "admin", "password": "secret-pass"},
                ).status_code
                == 200
            )

            bad = client.post(
                "/auth/change-password",
                json={
                    "current_password": "wrong",
                    "new_password": "new-admin-1",
                },
            )
            assert bad.status_code == 422, bad.text

            ok = client.post(
                "/auth/change-password",
                json={
                    "current_password": "secret-pass",
                    "new_password": "new-admin-1",
                },
            )
            assert ok.status_code == 204, ok.text

            client.post("/auth/logout")
            relogin = client.post(
                "/auth/login",
                json={"login": "admin", "password": "new-admin-1"},
            )
            assert relogin.status_code == 200, relogin.text

            set_pw = client.post(
                f"/platform-users/{target_id}/set-password",
                json={"new_password": "target-new-9"},
            )
            assert set_pw.status_code == 204, set_pw.text

            client.post("/auth/logout")
            target_login = client.post(
                "/auth/login",
                json={"login": "target", "password": "target-new-9"},
            )
            assert target_login.status_code == 200, target_login.text

            client.post("/auth/logout")
            plain_login = client.post(
                "/auth/login",
                json={"login": "plain", "password": "plain-pass-1"},
            )
            assert plain_login.status_code == 200, plain_login.text
            forbidden = client.post(
                f"/platform-users/{target_id}/set-password",
                json={"new_password": "should-fail"},
            )
            assert forbidden.status_code == 403, forbidden.text

        with factory() as db:
            row = db.get(PlatformUser, target_id)
            assert row is not None
            assert verify_password(row.password_hash, "target-new-9")
    finally:
        app.dependency_overrides.pop(get_db, None)
