from decimal import Decimal

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.database.base import Base
from app.database.session import get_db
from app.main import app
from app.models.sales import Client, Lead, SalesOrder, SalesOrderStatus, SalesUser


def _session_factory() -> sessionmaker[Session]:
    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine, expire_on_commit=False)


def test_client_history_mixes_orders_and_matching_leads() -> None:
    factory = _session_factory()
    with factory() as db:
        db.add(SalesUser(id=1, name="Мария"))
        client = Client(
            company_name="СК Олимп",
            contact_name="Иван Петров",
            phone="+79991112233",
            email="ivan@olymp.test",
            city="Казань",
            responsible_id=1,
        )
        empty = Client(contact_name="Анна Без истории", responsible_id=1)
        db.add_all([client, empty])
        db.flush()
        lead = Lead(
            contact_name="Иван Петров",
            company_name="СК Олимп",
            phone="+79991112233",
            email="ivan@olymp.test",
            responsible_id=1,
            sport="Футбол",
            source="website",
            need_description="Форма",
        )
        other = Lead(
            contact_name="Чужой",
            email="other@example.com",
            responsible_id=1,
        )
        db.add_all([lead, other])
        db.flush()
        db.add(
            SalesOrder(
                number="SO-H-1",
                lead_id=lead.id,
                client_id=client.id,
                status=SalesOrderStatus.CONFIRMED,
                title="Форма",
                sport="Футбол",
                amount=Decimal("12000.00"),
                responsible_id=1,
            )
        )
        db.commit()
        client_id = client.id
        empty_id = empty.id
        lead_id = lead.id

    def override_get_db():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with TestClient(app) as api:
            missing = api.get("/clients/999999/history")
            assert missing.status_code == 404

            empty_history = api.get(f"/clients/{empty_id}/history")
            assert empty_history.status_code == 200
            assert empty_history.json()["total"] == 0
            assert empty_history.json()["items"] == []

            all_rows = api.get(f"/clients/{client_id}/history")
            assert all_rows.status_code == 200
            body = all_rows.json()
            kinds = {item["kind"] for item in body["items"]}
            assert kinds == {"lead", "order"}
            assert body["total"] == 2
            assert any(item["id"] == lead_id and item["kind"] == "lead" for item in body["items"])
            assert any(item["kind"] == "order" and "SO-H-1" in item["title"] for item in body["items"])

            leads_only = api.get(f"/clients/{client_id}/history", params={"kind": "lead"})
            assert leads_only.status_code == 200
            assert leads_only.json()["total"] == 1
            assert leads_only.json()["items"][0]["kind"] == "lead"

            orders_only = api.get(f"/clients/{client_id}/history", params={"kind": "order"})
            assert orders_only.status_code == 200
            assert orders_only.json()["total"] == 1
            assert orders_only.json()["items"][0]["kind"] == "order"
    finally:
        app.dependency_overrides.pop(get_db, None)


def test_clients_list_does_not_embed_history() -> None:
    factory = _session_factory()
    with factory() as db:
        db.add(SalesUser(id=1, name="Мария"))
        db.add(Client(contact_name="Только список", responsible_id=1))
        db.commit()

    def override_get_db():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with TestClient(app) as api:
            listed = api.get("/clients")
            assert listed.status_code == 200
            assert "items" not in listed.json()[0]
            assert "history" not in listed.json()[0]
    finally:
        app.dependency_overrides.pop(get_db, None)
