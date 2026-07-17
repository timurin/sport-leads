import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.database.base import Base
from app.database.session import get_db
from app.main import app
from app.models.sales import Client, Lead, LeadContact


@pytest.fixture()
def session_factory() -> sessionmaker[Session]:
    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, expire_on_commit=False)
    yield factory
    Base.metadata.drop_all(engine)
    engine.dispose()


@pytest.fixture()
def client(session_factory: sessionmaker[Session]) -> TestClient:
    def override_get_db():
        with session_factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def add_lead(session_factory: sessionmaker[Session]) -> int:
    with session_factory() as db:
        lead = Lead(contact_name="Legacy contact", phone="+70000000000")
        db.add(lead)
        db.commit()
        return lead.id


def test_contact_crud_and_primary_projection(
    client: TestClient,
    session_factory: sessionmaker[Session],
) -> None:
    lead_id = add_lead(session_factory)
    first = client.post(
        f"/leads/{lead_id}/contacts",
        json={
            "name": "Иван Петров",
            "phone": "+79990000001",
            "email": "ivan@example.com",
            "preferred_channel": "email",
        },
    )
    assert first.status_code == 201
    assert first.json()["is_primary"] is True
    first_id = first.json()["id"]

    second = client.post(
        f"/leads/{lead_id}/contacts",
        json={"name": "Анна Смирнова", "phone": "+79990000002"},
    )
    assert second.status_code == 201
    assert second.json()["is_primary"] is False
    second_id = second.json()["id"]

    changed = client.patch(
        f"/leads/{lead_id}/contacts/{second_id}",
        json={"position": "Закупки", "email": "anna@example.com"},
    )
    assert changed.status_code == 200
    assert changed.json()["position"] == "Закупки"

    promoted = client.post(f"/leads/{lead_id}/contacts/{second_id}/set-primary")
    assert promoted.status_code == 200
    assert promoted.json()["is_primary"] is True

    lead_response = client.get(f"/leads/{lead_id}")
    assert lead_response.status_code == 200
    body = lead_response.json()
    assert body["contact_name"] == "Анна Смирнова"
    assert body["email"] == "anna@example.com"
    assert [item["id"] for item in body["contacts"]] == [second_id, first_id]
    assert sum(item["is_primary"] for item in body["contacts"]) == 1

    assert client.delete(f"/leads/{lead_id}/contacts/{first_id}").status_code == 204
    assert client.delete(f"/leads/{lead_id}/contacts/{second_id}").status_code == 409
    with session_factory() as db:
        assert db.scalar(
            select(func.count()).select_from(LeadContact).where(
                LeadContact.lead_id == lead_id,
                LeadContact.is_primary.is_(True),
            )
        ) == 1


def test_contact_endpoints_return_not_found_and_validate_input(
    client: TestClient,
    session_factory: sessionmaker[Session],
) -> None:
    lead_id = add_lead(session_factory)
    assert client.post("/leads/999/contacts", json={"name": "Unknown"}).status_code == 404
    assert client.patch(
        f"/leads/{lead_id}/contacts/999", json={"name": "Unknown"}
    ).status_code == 404
    assert client.delete(f"/leads/{lead_id}/contacts/999").status_code == 404
    assert client.post(
        f"/leads/{lead_id}/contacts/999/set-primary"
    ).status_code == 404
    assert client.post(
        f"/leads/{lead_id}/contacts", json={"name": "   "}
    ).status_code == 422
    assert client.post(
        f"/leads/{lead_id}/contacts",
        json={"name": "Bad email", "email": "not-an-email"},
    ).status_code == 422


def test_conversion_uses_primary_contact(
    client: TestClient,
    session_factory: sessionmaker[Session],
) -> None:
    lead_id = add_lead(session_factory)
    contact = client.post(
        f"/leads/{lead_id}/contacts",
        json={
            "name": "Основной контакт",
            "phone": "+79995550000",
            "email": "primary@example.com",
            "is_primary": True,
        },
    )
    assert contact.status_code == 201
    conversion = client.post(f"/leads/{lead_id}/convert", json={"completed_by_id": 1})
    assert conversion.status_code == 201
    with session_factory() as db:
        customer = db.scalar(select(Client))
        assert customer is not None
        assert customer.contact_name == "Основной контакт"
        assert customer.phone == "+79995550000"
        assert customer.email == "primary@example.com"
