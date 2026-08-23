from email.message import EmailMessage
from smtplib import SMTPException

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.communications.base import CommunicationConnector
from app.communications.connectors.email import (
    EMAIL_CONNECTOR_NAME,
    EmailCommunicationConnector,
    EmailConnectorConfig,
)
from app.communications.enums import CommunicationChannel
from app.config.settings import settings
from app.database.base import Base
from app.database.session import get_db
from app.main import app
from app.models.collaboration import CollaborationMessage
from app.models.sales import Lead, LeadMessage, LeadStatus, SalesUser


EMAIL_SECRET = "test-email-secret"


def _session_factory() -> sessionmaker[Session]:
    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, expire_on_commit=False)
    with factory() as db:
        db.add(SalesUser(id=1, name="System", is_active=True))
        db.add(
            Lead(
                id=1,
                status=LeadStatus.NEW,
                contact_name="Иван Тестов",
                company_name="ООО Тест",
                email="ivan@example.com",
                responsible_id=1,
            )
        )
        db.add(
            Lead(
                id=2,
                status=LeadStatus.NEW,
                contact_name="Без почты",
                responsible_id=1,
            )
        )
        db.commit()
    return factory


def _client(session_factory: sessionmaker[Session]) -> TestClient:
    def override_get_db():
        with session_factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    return TestClient(app)


@pytest.fixture(autouse=True)
def _clear_overrides() -> None:
    yield
    app.dependency_overrides.clear()


def _enable_smtp(monkeypatch: pytest.MonkeyPatch) -> list[EmailMessage]:
    sent: list[EmailMessage] = []

    def fake_transport(config: EmailConnectorConfig, message: EmailMessage) -> str:
        del config
        sent.append(message)
        return message["Message-ID"] or "smtp-test-id"

    monkeypatch.setattr(settings, "smtp_host", "smtp.test.local")
    monkeypatch.setattr(settings, "smtp_from", "crm@sport-lead.local")
    monkeypatch.setattr(settings, "smtp_username", "crm")
    monkeypatch.setattr(settings, "smtp_password", "unused")
    monkeypatch.setattr(
        "app.communications.connectors.email.smtp_transport",
        fake_transport,
    )
    return sent


def test_email_connector_is_communication_connector() -> None:
    connector = EmailCommunicationConnector(
        EmailConnectorConfig(host="smtp.test", from_address="crm@example.com")
    )
    assert isinstance(connector, CommunicationConnector)
    assert connector.name == EMAIL_CONNECTOR_NAME
    assert connector.channel is CommunicationChannel.EMAIL


def test_smtp_email_send_is_not_mock(monkeypatch: pytest.MonkeyPatch) -> None:
    factory = _session_factory()
    sent = _enable_smtp(monkeypatch)
    with _client(factory) as client:
        response = client.post(
            "/leads/1/messages",
            json={
                "channel": "email",
                "text": "Коммерческое предложение во вложении.",
                "recipient_name": "Иван Тестов",
                "author_id": 1,
            },
        )
        assert response.status_code == 201, response.text
        body = response.json()
        assert body["is_mock"] is False
        assert body["external_id"].startswith("<lead-1-")
        assert body["channel"] == "email"
    assert len(sent) == 1
    assert sent[0]["To"] == "ivan@example.com"
    with factory() as db:
        stored = db.scalar(select(LeadMessage).where(LeadMessage.lead_id == 1))
        assert stored is not None
        assert stored.is_mock is False
        assert stored.external_id == body["external_id"]


def test_telegram_stays_mock_when_smtp_configured(monkeypatch: pytest.MonkeyPatch) -> None:
    factory = _session_factory()
    _enable_smtp(monkeypatch)
    with _client(factory) as client:
        response = client.post(
            "/leads/1/messages",
            json={"channel": "telegram", "text": "Напишите в Telegram"},
        )
        assert response.status_code == 201, response.text
        assert response.json()["is_mock"] is True
        assert response.json()["external_id"].startswith("mock-")


def test_smtp_send_requires_lead_email(monkeypatch: pytest.MonkeyPatch) -> None:
    factory = _session_factory()
    sent = _enable_smtp(monkeypatch)
    with _client(factory) as client:
        response = client.post(
            "/leads/2/messages",
            json={"channel": "email", "text": "Нет адреса у лида"},
        )
        assert response.status_code == 422
        assert "email" in response.json()["detail"].lower()
    assert sent == []


def test_smtp_failure_is_502_not_silent_mock(monkeypatch: pytest.MonkeyPatch) -> None:
    factory = _session_factory()

    def boom(config: EmailConnectorConfig, message: EmailMessage) -> str:
        del config, message
        raise SMTPException("connection refused")

    monkeypatch.setattr(settings, "smtp_host", "smtp.test.local")
    monkeypatch.setattr(settings, "smtp_from", "crm@sport-lead.local")
    monkeypatch.setattr(
        "app.communications.connectors.email.smtp_transport",
        boom,
    )
    with _client(factory) as client:
        response = client.post(
            "/leads/1/messages",
            json={"channel": "email", "text": "Должно упасть честно"},
        )
        assert response.status_code == 502
    with factory() as db:
        assert db.scalar(select(func.count()).select_from(LeadMessage)) == 0


def test_inbound_email_persists_lead_message_not_collaboration(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    factory = _session_factory()
    monkeypatch.setattr(settings, "lead_email_webhook_secret", EMAIL_SECRET)
    with _client(factory) as client:
        response = client.post(
            "/leads/messages/inbound/email",
            json={
                "event_id": "evt-1",
                "message_id": "<reply-1@mail.example>",
                "from_email": "ivan@example.com",
                "from_name": "Иван Тестов",
                "text": "Готовы обсудить тираж.",
                "sent_at": "2026-08-23T12:00:00Z",
            },
            headers={"X-Sport-Lead-Email-Secret": EMAIL_SECRET},
        )
        assert response.status_code == 200, response.text
        body = response.json()
        assert len(body) == 1
        assert body[0]["direction"] == "incoming"
        assert body[0]["is_mock"] is False
        assert body[0]["lead_id"] == 1
        assert body[0]["external_id"] == "<reply-1@mail.example>"

        repeat = client.post(
            "/leads/messages/inbound/email",
            json={
                "event_id": "evt-1-repeat",
                "message_id": "<reply-1@mail.example>",
                "from_email": "ivan@example.com",
                "text": "Готовы обсудить тираж.",
                "sent_at": "2026-08-23T12:01:00Z",
            },
            headers={"X-Sport-Lead-Email-Secret": EMAIL_SECRET},
        )
        assert repeat.status_code == 200
        assert repeat.json()[0]["id"] == body[0]["id"]

    with factory() as db:
        assert db.scalar(select(func.count()).select_from(LeadMessage)) == 1
        assert db.scalar(select(func.count()).select_from(CollaborationMessage)) == 0


def test_inbound_email_secret_gates(monkeypatch: pytest.MonkeyPatch) -> None:
    factory = _session_factory()
    payload = {
        "event_id": "evt-2",
        "message_id": "<reply-2@mail.example>",
        "from_email": "ivan@example.com",
        "text": "Секрет обязателен",
        "sent_at": "2026-08-23T12:00:00Z",
        "lead_id": 1,
    }
    monkeypatch.setattr(settings, "lead_email_webhook_secret", None)
    with _client(factory) as client:
        missing = client.post("/leads/messages/inbound/email", json=payload)
        assert missing.status_code == 503

    monkeypatch.setattr(settings, "lead_email_webhook_secret", EMAIL_SECRET)
    with _client(factory) as client:
        bad = client.post(
            "/leads/messages/inbound/email",
            json=payload,
            headers={"X-Sport-Lead-Email-Secret": "wrong"},
        )
        assert bad.status_code == 401
