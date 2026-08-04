"""Stage 17.1.3.2 — audit_events persist + query + emitters."""

from __future__ import annotations

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.database.base import Base
from app.database.session import get_db
from app.main import app
from app.models.size_grid import SizeGridSizeType
from tests.auth_test_helpers import ensure_user_with_role, login_client


def _session_factory() -> sessionmaker[Session]:
    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine, expire_on_commit=False)


def test_audit_emit_on_size_grid_and_query_gated() -> None:
    factory = _session_factory()

    def override_get_db():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with factory() as db:
            ensure_user_with_role(db, login="admin", role_code="admin")
            ensure_user_with_role(
                db, login="catalog", role_code="catalog_editor"
            )
            ensure_user_with_role(db, login="ops", role_code="shop_operator")

        with TestClient(app) as client:
            assert client.get("/audit-events").status_code == 401

            login_client(client, login="catalog")
            created = client.post(
                "/size-grids",
                json={
                    "name": "Audit Grid",
                    "size_type": SizeGridSizeType.MEN.value,
                    "source_note": "test",
                    "rows": [
                        {
                            "sort_order": 0,
                            "ru_size": "44",
                            "int_label": "S",
                            "chest": "88-92",
                            "waist": "76-80",
                            "hip": "96-100",
                        }
                    ],
                },
            )
            assert created.status_code == 201, created.text
            grid_id = created.json()["id"]

            forbidden = client.get("/audit-events")
            assert forbidden.status_code == 403
            client.post("/auth/logout")

            login_client(client, login="admin")
            listed = client.get(
                "/audit-events",
                params={"entity_type": "size_grid", "entity_id": str(grid_id)},
            )
            assert listed.status_code == 200, listed.text
            items = listed.json()["items"]
            assert len(items) >= 1
            assert items[0]["action"] == "size_grid.create"
            assert items[0]["actor_login"] == "catalog"

            one = client.get(f"/audit-events/{items[0]['id']}")
            assert one.status_code == 200
            assert one.json()["entity_id"] == str(grid_id)

            login_client(client, login="ops")
            assert client.get("/audit-events").status_code == 403
    finally:
        app.dependency_overrides.pop(get_db, None)


def test_audit_emit_on_role_assign() -> None:
    factory = _session_factory()

    def override_get_db():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with factory() as db:
            ensure_user_with_role(db, login="admin", role_code="admin")
            target_id = ensure_user_with_role(
                db, login="target", role_code="catalog_editor"
            )

        with TestClient(app) as client:
            login_client(client, login="admin")
            assigned = client.post(
                f"/platform-users/{target_id}/roles",
                json={"role_code": "shop_operator"},
            )
            assert assigned.status_code == 200, assigned.text

            listed = client.get(
                "/audit-events",
                params={"action": "role.assign", "entity_id": str(target_id)},
            )
            assert listed.status_code == 200
            assert listed.json()["items"][0]["action"] == "role.assign"
            assert listed.json()["items"][0]["payload"]["role_code"] == "shop_operator"
    finally:
        app.dependency_overrides.pop(get_db, None)


def test_audit_size_grid_id_filter_includes_rows() -> None:
    factory = _session_factory()

    def override_get_db():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with factory() as db:
            ensure_user_with_role(db, login="admin", role_code="admin")

        with TestClient(app) as client:
            login_client(client, login="admin")
            created = client.post(
                "/size-grids",
                json={
                    "name": "Filter Grid",
                    "size_type": "kids",
                    "source_note": "test",
                    "rows": [
                        {
                            "sort_order": 0,
                            "ru_size": "28",
                            "int_label": "110",
                            "chest": "56-60",
                            "waist": "50-54",
                            "hip": "60-64",
                        }
                    ],
                },
            )
            assert created.status_code == 201, created.text
            grid_id = created.json()["id"]

            added = client.post(
                f"/size-grids/{grid_id}/rows",
                json={
                    "sort_order": 1,
                    "ru_size": "30",
                    "int_label": "116",
                    "chest": "60-64",
                    "waist": "52-56",
                    "hip": "64-68",
                },
            )
            assert added.status_code == 201, added.text

            listed = client.get(
                "/audit-events",
                params={"size_grid_id": grid_id},
            )
            assert listed.status_code == 200, listed.text
            actions = {item["action"] for item in listed.json()["items"]}
            assert "size_grid.create" in actions
            assert "size_grid.row.create" in actions
    finally:
        app.dependency_overrides.pop(get_db, None)
