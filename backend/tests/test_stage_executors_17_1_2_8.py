"""Stage 17.1.2.8 — stage executor list + directory/fallback."""

from __future__ import annotations

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.database.base import Base
from app.database.session import get_db
from app.main import app
from app.models.production_stage import ProductionStage
from tests.auth_test_helpers import ensure_user_with_role, login_client


def _session_factory() -> sessionmaker[Session]:
    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine, expire_on_commit=False)


def test_stage_executors_role_fallback_and_directory() -> None:
    factory = _session_factory()

    def override_get_db():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with factory() as db:
            stage = ProductionStage(
                name="Раскрой",
                code="cutting",
                is_active=True,
                sort_order=10,
            )
            db.add(stage)
            db.commit()
            stage_id = stage.id
            ensure_user_with_role(db, login="admin", role_code="admin")
            ops_id = ensure_user_with_role(
                db, login="ops", role_code="shop_operator"
            )
            ensure_user_with_role(
                db, login="catalog", role_code="catalog_editor"
            )

        with TestClient(app) as client:
            assert (
                client.get(
                    "/shop-stage-executors",
                    params={"stage_code": "cutting"},
                ).status_code
                == 401
            )

            login_client(client, login="catalog")
            listed = client.get(
                "/shop-stage-executors",
                params={"stage_code": "cutting"},
            )
            assert listed.status_code == 200, listed.text
            body = listed.json()
            assert body["source"] == "role_fallback"
            logins = {item["login"] for item in body["items"]}
            assert "ops" in logins
            assert "admin" in logins
            assert "catalog" not in logins
            client.post("/auth/logout")

            login_client(client, login="admin")
            replaced = client.put(
                f"/production-stages/{stage_id}/executors",
                json={"platform_user_ids": [ops_id]},
            )
            assert replaced.status_code == 200, replaced.text
            assert replaced.json()["source"] == "directory"
            assert [item["login"] for item in replaced.json()["items"]] == [
                "ops"
            ]

            listed2 = client.get(
                "/shop-stage-executors",
                params={"stage_code": "cutting"},
            )
            assert listed2.status_code == 200
            assert listed2.json()["source"] == "directory"
            assert len(listed2.json()["items"]) == 1
    finally:
        app.dependency_overrides.pop(get_db, None)
