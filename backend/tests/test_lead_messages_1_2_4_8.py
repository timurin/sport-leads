from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.database.base import Base
from app.database.session import get_db
from app.main import app
from app.models.sales import Lead, LeadMessage, LeadStatus, SalesUser
import pytest


@pytest.fixture()
def session_factory() -> sessionmaker[Session]:
    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, expire_on_commit=False)
    with factory() as db:
        db.add(SalesUser(id=1, name="System", is_active=True))
        db.add(SalesUser(id=2, name="Manager Two", is_active=True))
        db.add(
            Lead(
                id=1,
                status=LeadStatus.NEW,
                contact_name="Иван Тестов",
                company_name="ООО Тест",
                responsible_id=1,
            )
        )
        db.commit()
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


def test_lead_message_create_list_and_mock_send(
    client: TestClient, session_factory: sessionmaker[Session]
) -> None:
    create = client.post(
        "/leads/1/messages",
        json={
            "channel": "email",
            "text": "Добрый день! Уточните количество комплектов.",
            "recipient_name": "Иван Тестов",
            "author_id": 1,
            "attachments": [
                {"id": "att-1", "name": "brief.pdf", "type": "application/pdf", "size": 1200}
            ],
        },
    )
    assert create.status_code == 201, create.text
    message = create.json()
    assert message["channel"] == "email"
    assert message["direction"] == "outgoing"
    assert message["status"] == "sent"
    assert message["is_mock"] is True
    assert message["author_name"] == "System"
    assert message["external_id"].startswith("mock-")
    assert message["attachments"][0]["name"] == "brief.pdf"

    listed = client.get("/leads/1/messages")
    assert listed.status_code == 200
    assert len(listed.json()) == 1
    assert listed.json()[0]["id"] == message["id"]

    with session_factory() as db:
        stored = db.scalar(select(LeadMessage).where(LeadMessage.lead_id == 1))
        assert stored is not None
        assert stored.is_mock is True
        assert stored.text.startswith("Добрый день")


def test_lead_message_defaults_author_from_responsible(client: TestClient) -> None:
    response = client.post(
        "/leads/1/messages",
        json={"channel": "telegram", "text": "Без явного автора"},
    )
    assert response.status_code == 201, response.text
    assert response.json()["author_id"] == 1


def test_lead_message_rejects_blank_without_attachment(client: TestClient) -> None:
    response = client.post("/leads/1/messages", json={"channel": "email", "text": "   "})
    assert response.status_code == 422


def test_lead_message_rejects_phone_channel(client: TestClient) -> None:
    response = client.post(
        "/leads/1/messages",
        json={"channel": "phone", "text": "Нельзя отправить текстом"},
    )
    assert response.status_code == 422
