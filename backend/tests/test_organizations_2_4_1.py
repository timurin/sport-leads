"""Stage 2.4.1 — organizations CRUD vs demo catalog."""

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.database.base import Base
from app.database.session import get_db
from app.main import app
from app.models.sales import Organization


def _session_factory() -> sessionmaker[Session]:
    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine, expire_on_commit=False)


def test_organizations_crud_and_active_only_default() -> None:
    factory = _session_factory()
    with factory() as db:
        db.add_all(
            [
                Organization(name="Активная", tax_id="7707083893", is_active=True),
                Organization(name="Архив", tax_id="7700000000", is_active=False),
            ]
        )
        db.commit()

    def override_get_db():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with TestClient(app) as api:
            active = api.get("/organizations")
            assert active.status_code == 200
            names = [row["name"] for row in active.json()]
            assert names == ["Активная"]
            assert "legal_address" in active.json()[0]
            assert "bank_accounts" not in active.json()[0]

            all_rows = api.get("/organizations", params={"active_only": False})
            assert {row["name"] for row in all_rows.json()} == {"Активная", "Архив"}

            missing = api.get("/organizations/999999")
            assert missing.status_code == 404

            created = api.post(
                "/organizations",
                json={"name": "  ООО Новая  ", "tax_id": "6311000000", "kpp": "631101001"},
            )
            assert created.status_code == 201
            body = created.json()
            assert body["name"] == "ООО Новая"
            assert body["tax_id"] == "6311000000"
            org_id = body["id"]

            detail = api.get(f"/organizations/{org_id}")
            assert detail.status_code == 200
            assert detail.json()["kpp"] == "631101001"

            conflict = api.post("/organizations", json={"name": "Дубль", "tax_id": "6311000000"})
            assert conflict.status_code == 409

            empty_patch = api.patch(f"/organizations/{org_id}", json={})
            assert empty_patch.status_code == 422

            patched = api.patch(
                f"/organizations/{org_id}",
                json={"director": "Иванов", "legal_address": "Самара", "is_active": False},
            )
            assert patched.status_code == 200
            assert patched.json()["director"] == "Иванов"
            assert patched.json()["is_active"] is False

            still_hidden = api.get("/organizations")
            assert all(row["id"] != org_id for row in still_hidden.json())
    finally:
        app.dependency_overrides.clear()
