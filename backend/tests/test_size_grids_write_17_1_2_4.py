"""Stage 17.1.2.4 — size-grid write API gated by size_grids.write."""

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


def _login(client: TestClient, login: str, password: str = "secret-pass") -> None:
    response = client.post(
        "/auth/login",
        json={"login": login, "password": password},
    )
    assert response.status_code == 200, response.text


def test_size_grid_write_requires_permission_and_crud() -> None:
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
            plain = create_platform_user(
                db,
                login="plain",
                password="secret-pass",
                display_name="Plain",
            )
            assert plain.id != admin.id

        with TestClient(app) as client:
            payload = {
                "name": "Kids custom",
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
                        "height_s": None,
                        "height_n": "110-116",
                        "height_t": None,
                    }
                ],
            }

            denied = client.post("/size-grids", json=payload)
            assert denied.status_code == 401

            _login(client, "plain")
            forbidden = client.post("/size-grids", json=payload)
            assert forbidden.status_code == 403
            client.post("/auth/logout")

            _login(client, "admin")
            created = client.post("/size-grids", json=payload)
            assert created.status_code == 201, created.text
            body = created.json()
            grid_id = body["id"]
            assert body["name"] == "Kids custom"
            assert len(body["rows"]) == 1
            row_id = body["rows"][0]["id"]

            patched = client.patch(
                f"/size-grids/{grid_id}",
                json={"name": "Kids custom v2", "source_note": None},
            )
            assert patched.status_code == 200, patched.text
            assert patched.json()["name"] == "Kids custom v2"
            assert patched.json()["source_note"] is None

            added = client.post(
                f"/size-grids/{grid_id}/rows",
                json={
                    "sort_order": 1,
                    "ru_size": "30",
                    "int_label": "116",
                    "chest": "60-64",
                    "waist": "54-58",
                    "hip": "64-68",
                },
            )
            assert added.status_code == 201, added.text
            assert len(added.json()["rows"]) == 2

            updated_row = client.patch(
                f"/size-grids/{grid_id}/rows/{row_id}",
                json={"chest": "57-61"},
            )
            assert updated_row.status_code == 200, updated_row.text
            row_28 = next(
                r for r in updated_row.json()["rows"] if r["id"] == row_id
            )
            assert row_28["chest"] == "57-61"

            deleted_row = client.delete(f"/size-grids/{grid_id}/rows/{row_id}")
            assert deleted_row.status_code == 200, deleted_row.text
            assert len(deleted_row.json()["rows"]) == 1

            removed = client.delete(f"/size-grids/{grid_id}")
            assert removed.status_code == 204, removed.text
            assert client.get(f"/size-grids/{grid_id}").status_code == 404
    finally:
        app.dependency_overrides.pop(get_db, None)
