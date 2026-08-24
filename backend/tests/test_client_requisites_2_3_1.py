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


def test_client_requisites_and_bank_accounts() -> None:
    factory = _session_factory()
    with factory() as db:
        db.add(SalesUser(id=1, name="Мария"))
        client = Client(contact_name="Иван Петров", responsible_id=1)
        db.add(client)
        db.commit()
        client_id = client.id

    def override_get_db():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with TestClient(app) as api:
            listed = api.get("/clients")
            assert listed.status_code == 200
            assert "bank_accounts" not in listed.json()[0]
            assert "legal_address" not in listed.json()[0]
            assert "inn" not in listed.json()[0]

            empty_patch = api.patch(f"/clients/{client_id}", json={})
            assert empty_patch.status_code == 422

            bad_inn = api.patch(f"/clients/{client_id}", json={"inn": "123"})
            assert bad_inn.status_code == 422

            updated = api.patch(
                f"/clients/{client_id}",
                json={
                    "inn": "7707083893",
                    "kpp": "770701001",
                    "ogrn": "1027700132195",
                    "legal_address": "Москва, ул. Тверская, 1",
                    "actual_address": "Казань, ул. Баумана, 2",
                },
            )
            assert updated.status_code == 200, updated.text
            body = updated.json()
            assert body["inn"] == "7707083893"
            assert body["kpp"] == "770701001"
            assert body["legal_address"].startswith("Москва")
            assert body["bank_accounts"] == []

            created = api.post(
                f"/clients/{client_id}/bank-accounts",
                json={
                    "bank_name": " Сбер ",
                    "bik": "044525225",
                    "account_number": "40702810900000000001",
                    "corr_account": "30101810400000000225",
                },
            )
            assert created.status_code == 201, created.text
            account_id = created.json()["id"]
            assert created.json()["is_primary"] is True
            assert created.json()["bank_name"] == "Сбер"

            second = api.post(
                f"/clients/{client_id}/bank-accounts",
                json={
                    "bank_name": "ВТБ",
                    "bik": "044525187",
                    "account_number": "40702810900000000002",
                    "is_primary": True,
                },
            )
            assert second.status_code == 201, second.text
            second_id = second.json()["id"]
            detail = api.get(f"/clients/{client_id}")
            assert detail.status_code == 200
            primaries = [row for row in detail.json()["bank_accounts"] if row["is_primary"]]
            assert len(primaries) == 1
            assert primaries[0]["id"] == second_id

            folder_only = api.patch(f"/clients/{client_id}", json={"folder_id": None})
            assert folder_only.status_code == 200
            assert folder_only.json()["inn"] == "7707083893"

            deleted = api.delete(f"/clients/{client_id}/bank-accounts/{second_id}")
            assert deleted.status_code == 204
            after = api.get(f"/clients/{client_id}").json()["bank_accounts"]
            assert len(after) == 1
            assert after[0]["id"] == account_id
            assert after[0]["is_primary"] is True
    finally:
        app.dependency_overrides.pop(get_db, None)
