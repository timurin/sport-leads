"""Stage 2.3.2 — client segments and duplicate candidates."""

from __future__ import annotations

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.database.base import Base
from app.database.session import get_db
from app.main import app
from app.models.sales import Client, SalesUser


def _session_factory() -> sessionmaker[Session]:
    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine, expire_on_commit=False)


def test_segments_and_duplicate_candidates() -> None:
    factory = _session_factory()
    with factory() as db:
        db.add(SalesUser(id=1, name="Мария"))
        first = Client(
            contact_name="Иван Петров",
            company_name="ООО Спорт",
            phone="89001112233",
            inn="7707083893",
            responsible_id=1,
        )
        second = Client(
            contact_name="Другой",
            company_name="Иное",
            phone="79990001122",
            responsible_id=1,
        )
        db.add_all([first, second])
        db.commit()
        first_id = first.id
        second_id = second.id

    def override_get_db():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with TestClient(app) as api:
            listed = api.get("/clients")
            assert listed.status_code == 200
            assert "segments" not in listed.json()[0]

            empty = api.get("/clients/duplicate-candidates")
            assert empty.status_code == 422

            by_phone = api.get(
                "/clients/duplicate-candidates",
                params={"phone": "+7 (900) 111-22-33", "exclude_client_id": second_id},
            )
            assert by_phone.status_code == 200, by_phone.text
            assert by_phone.json()[0]["id"] == first_id
            assert "phone" in by_phone.json()[0]["matched_on"]

            by_inn = api.get(
                "/clients/duplicate-candidates",
                params={"inn": "7707083893", "exclude_client_id": first_id},
            )
            assert by_inn.json() == []

            by_name = api.get(
                "/clients/duplicate-candidates",
                params={"name": "ооо спорт"},
            )
            assert any(row["id"] == first_id for row in by_name.json())

            created = api.post(
                "/clients",
                json={
                    "contact_name": "Новый контакт",
                    "company_name": "Новая фирма",
                    "phone": "79991112233",
                    "inn": "7707083893",
                },
            )
            assert created.status_code == 201, created.text
            new_id = created.json()["id"]
            assert created.json()["inn"] == "7707083893"
            assert created.json()["segments"] == []

            replaced = api.put(
                f"/clients/{new_id}/segments",
                json={"tags": [" VIP ", "школа", "vip", ""]},
            )
            assert replaced.status_code == 200, replaced.text
            assert replaced.json() == ["VIP", "школа"]

            detail = api.get(f"/clients/{new_id}")
            assert detail.status_code == 200
            assert detail.json()["segments"] == ["VIP", "школа"]

            too_long = api.put(
                f"/clients/{new_id}/segments",
                json={"tags": ["x" * 65]},
            )
            assert too_long.status_code == 422

            missing = api.put("/clients/99999/segments", json={"tags": ["a"]})
            assert missing.status_code == 404
    finally:
        app.dependency_overrides.pop(get_db, None)
