"""Stage 17.1.2.2–17.1.2.3 — roles/permissions + deny-by-default assign API."""

from __future__ import annotations

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.database.base import Base
from app.database.session import get_db
from app.main import app
from app.services.auth import SESSION_COOKIE_NAME, create_platform_user
from app.services import rbac as rbac_service


def _session_factory() -> sessionmaker[Session]:
    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine, expire_on_commit=False)


def test_me_includes_roles_after_admin_seed() -> None:
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
            login = client.post(
                "/auth/login",
                json={"login": "admin", "password": "secret-pass"},
            )
            assert login.status_code == 200, login.text
            me = client.get("/auth/me")
            assert me.status_code == 200, me.text
            body = me.json()
            assert "admin" in body["roles"]
            assert rbac_service.PERM_ADMIN_ROLES_ASSIGN in body["permissions"]
            assert rbac_service.PERM_SIZE_GRIDS_WRITE in body["permissions"]
    finally:
        app.dependency_overrides.pop(get_db, None)


def test_role_assign_requires_permission() -> None:
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
            editor = create_platform_user(
                db,
                login="editor",
                password="secret-pass",
                display_name="Editor",
            )
            plain = create_platform_user(
                db,
                login="plain",
                password="secret-pass",
                display_name="Plain",
            )
            admin_id = admin.id
            editor_id = editor.id
            plain_id = plain.id

        with TestClient(app) as client:
            denied = client.post(
                f"/platform-users/{editor_id}/roles",
                json={"role_code": "catalog_editor"},
            )
            assert denied.status_code == 401

            client.post(
                "/auth/login",
                json={"login": "plain", "password": "secret-pass"},
            )
            forbidden = client.post(
                f"/platform-users/{editor_id}/roles",
                json={"role_code": "catalog_editor"},
            )
            assert forbidden.status_code == 403
            client.post("/auth/logout")

            client.post(
                "/auth/login",
                json={"login": "admin", "password": "secret-pass"},
            )
            assert SESSION_COOKIE_NAME in client.cookies
            assigned = client.post(
                f"/platform-users/{editor_id}/roles",
                json={"role_code": "catalog_editor"},
            )
            assert assigned.status_code == 200, assigned.text
            assert "catalog_editor" in assigned.json()["roles"]
            assert (
                rbac_service.PERM_SIZE_GRIDS_WRITE
                in assigned.json()["permissions"]
            )

            roles = client.get("/roles")
            assert roles.status_code == 200, roles.text
            codes = {item["code"] for item in roles.json()["items"]}
            assert codes == {"admin", "catalog_editor", "shop_operator"}

            listed = client.get("/platform-users")
            assert listed.status_code == 200, listed.text
            logins = {item["login"] for item in listed.json()["items"]}
            assert {"admin", "editor", "plain"} <= logins

            revoked = client.delete(
                f"/platform-users/{editor_id}/roles/catalog_editor"
            )
            assert revoked.status_code == 200, revoked.text
            assert "catalog_editor" not in revoked.json()["roles"]

            # admin_id sanity: self still has admin after other ops
            me = client.get("/auth/me")
            assert me.json()["id"] == admin_id
            assert plain_id != admin_id
    finally:
        app.dependency_overrides.pop(get_db, None)
