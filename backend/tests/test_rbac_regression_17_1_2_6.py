"""Stage 17.1.2.6 — forbidden without role; allowed with role (size-grid + kanban)."""

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


def test_size_grid_and_role_assign_forbidden_allowed() -> None:
    factory = _session_factory()

    def override_get_db():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with factory() as db:
            rbac_service.ensure_rbac_seed(db)
            ensure_user_with_role(db, login="admin", role_code="admin")
            ensure_user_with_role(
                db, login="catalog", role_code="catalog_editor"
            )
            plain = create_platform_user(
                db,
                login="plain",
                password="secret-pass",
                display_name="Plain",
            )
            plain_id = plain.id

        grid_payload = {
            "name": "Kids regression",
            "size_type": "kids",
            "rows": [],
        }

        with TestClient(app) as client:
            assert client.post("/size-grids", json=grid_payload).status_code == 401

            login_client(client, login="plain")
            assert client.post("/size-grids", json=grid_payload).status_code == 403
            assert (
                client.post(
                    f"/platform-users/{plain_id}/roles",
                    json={"role_code": "catalog_editor"},
                ).status_code
                == 403
            )
            client.post("/auth/logout")

            login_client(client, login="catalog")
            created = client.post("/size-grids", json=grid_payload)
            assert created.status_code == 201, created.text
            # catalog_editor cannot assign roles
            assert (
                client.post(
                    f"/platform-users/{plain_id}/roles",
                    json={"role_code": "shop_operator"},
                ).status_code
                == 403
            )
            client.post("/auth/logout")

            login_client(client, login="admin")
            assigned = client.post(
                f"/platform-users/{plain_id}/roles",
                json={"role_code": "shop_operator"},
            )
            assert assigned.status_code == 200, assigned.text
            assert "shop_operator" in assigned.json()["roles"]
    finally:
        app.dependency_overrides.pop(get_db, None)


def test_shop_stage_complete_requires_kanban_permission() -> None:
    """Unauthenticated / wrong role → 401/403 on complete; shop_operator allowed to call."""
    factory = _session_factory()

    def override_get_db():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with factory() as db:
            ensure_user_with_role(
                db, login="ops", role_code="shop_operator"
            )
            ensure_user_with_role(
                db, login="catalog", role_code="catalog_editor"
            )

        # Use a non-existent card: permission check runs before domain 404.
        path = "/technical-cards/999999/stages/1/complete"

        with TestClient(app) as client:
            assert client.post(path, json={}).status_code == 401

            login_client(client, login="catalog")
            assert client.post(path, json={}).status_code == 403
            client.post("/auth/logout")

            login_client(client, login="ops")
            # Past permission gate → domain 404 (card missing)
            denied_domain = client.post(path, json={})
            assert denied_domain.status_code == 404, denied_domain.text

            rollback_path = (
                "/technical-cards/999999/stages/1/rollback-kanban"
            )
            assert client.post(rollback_path).status_code == 404
    finally:
        app.dependency_overrides.pop(get_db, None)
