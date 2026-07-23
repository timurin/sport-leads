from decimal import Decimal

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.database.base import Base
from app.database.session import get_db
from app.main import app


def _session_factory() -> sessionmaker[Session]:
    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine, expire_on_commit=False)


def test_sewing_operations_crud_and_unique_name() -> None:
    factory = _session_factory()

    def override_get_db():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with TestClient(app) as client:
            created = client.post(
                "/sewing-operations",
                json={
                    "name": " Базовая сборка ",
                    "cost": "120.50",
                    "duration_seconds": 125,
                },
            )
            assert created.status_code == 201, created.text
            body = created.json()
            assert body["name"] == "Базовая сборка"
            assert Decimal(body["cost"]) == Decimal("120.50")
            assert body["duration_seconds"] == 125
            operation_id = body["id"]

            duplicate = client.post(
                "/sewing-operations",
                json={"name": "Базовая сборка", "cost": "10.00"},
            )
            assert duplicate.status_code == 409

            listed = client.get("/sewing-operations")
            assert listed.status_code == 200
            assert len(listed.json()) == 1

            searched = client.get("/sewing-operations", params={"search": "сборка"})
            assert searched.status_code == 200
            assert len(searched.json()) == 1

            patched = client.patch(
                f"/sewing-operations/{operation_id}",
                json={"cost": "130.00", "duration_seconds": 90},
            )
            assert patched.status_code == 200, patched.text
            assert Decimal(patched.json()["cost"]) == Decimal("130.00")
            assert patched.json()["duration_seconds"] == 90

            negative = client.post(
                "/sewing-operations",
                json={"name": "Брак", "cost": "-1"},
            )
            assert negative.status_code == 422

            negative_duration = client.post(
                "/sewing-operations",
                json={"name": "Брак", "cost": "1", "duration_seconds": -5},
            )
            assert negative_duration.status_code == 422

            deleted = client.delete(f"/sewing-operations/{operation_id}")
            assert deleted.status_code == 204

            missing = client.get(f"/sewing-operations/{operation_id}")
            assert missing.status_code == 404
    finally:
        app.dependency_overrides.clear()
