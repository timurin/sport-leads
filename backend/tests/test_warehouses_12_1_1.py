"""Stage 12.1.1 — Warehouses CRUD + default seed «Основной»."""

from __future__ import annotations

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.database.base import Base
from app.database.session import get_db
from app.main import app
from app.models.warehouse import Warehouse


def _session_factory() -> sessionmaker[Session]:
    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine, expire_on_commit=False)


def _seed_default(db: Session) -> int:
    row = Warehouse(
        name="Основной",
        code="main",
        is_active=True,
        is_default=True,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row.id


def test_warehouses_crud_and_default_seed_rules() -> None:
    factory = _session_factory()

    def override_get_db():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with factory() as db:
            default_id = _seed_default(db)

        with TestClient(app) as client:
            listed = client.get("/warehouses")
            assert listed.status_code == 200, listed.text
            rows = listed.json()
            assert len(rows) == 1
            assert rows[0]["name"] == "Основной"
            assert rows[0]["code"] == "main"
            assert rows[0]["is_default"] is True

            created = client.post(
                "/warehouses",
                json={
                    "name": "Резервный",
                    "code": "reserve",
                    "is_active": True,
                    "is_default": False,
                },
            )
            assert created.status_code == 201, created.text
            reserve_id = created.json()["id"]

            conflict = client.post(
                "/warehouses",
                json={
                    "name": "Резервный",
                    "code": "other",
                    "is_active": True,
                    "is_default": False,
                },
            )
            assert conflict.status_code == 409

            promote = client.patch(
                f"/warehouses/{reserve_id}",
                json={"is_default": True},
            )
            assert promote.status_code == 200, promote.text
            assert promote.json()["is_default"] is True

            with factory() as db:
                former = db.get(Warehouse, default_id)
                assert former is not None
                assert former.is_default is False

            deny_delete_default = client.delete(f"/warehouses/{reserve_id}")
            assert deny_delete_default.status_code == 422

            delete_old = client.delete(f"/warehouses/{default_id}")
            assert delete_old.status_code == 204

            with factory() as db:
                remaining = list(db.scalars(select(Warehouse)).all())
                assert len(remaining) == 1
                assert remaining[0].id == reserve_id
                assert remaining[0].is_default is True
    finally:
        app.dependency_overrides.pop(get_db, None)
