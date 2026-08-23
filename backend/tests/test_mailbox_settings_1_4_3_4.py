from email.message import EmailMessage

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.config.settings import settings
from app.database.base import Base
from app.database.session import get_db
from app.main import app
from app.models.sales import Lead, LeadMessage, LeadStatus, SalesUser
from app.services.auth import create_platform_user
from app.services import rbac as rbac_service
from tests.auth_test_helpers import login_client


def _session_factory() -> sessionmaker[Session]:
    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine, expire_on_commit=False)


def _client(factory: sessionmaker[Session]) -> TestClient:
    def override_get_db():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    return TestClient(app)


def _admin(factory: sessionmaker[Session]) -> None:
    with factory() as db:
        user = create_platform_user(
            db,
            login="admin",
            password="secret-pass",
            display_name="Admin",
        )
        rbac_service.ensure_admin_role_for_user(db, user)


def test_mailbox_settings_get_requires_auth() -> None:
    factory = _session_factory()
    try:
        with _client(factory) as client:
            response = client.get("/mailbox-settings")
            assert response.status_code == 401, response.text
    finally:
        app.dependency_overrides.pop(get_db, None)


def test_mailbox_settings_read_update_masks_secrets() -> None:
    factory = _session_factory()
    _admin(factory)
    try:
        with _client(factory) as client:
            login_client(client, login="admin")
            first = client.get("/mailbox-settings")
            assert first.status_code == 200, first.text
            body = first.json()
            assert body["id"] == 1
            assert body["smtp_password_set"] is False
            assert "smtp_password" not in body
            assert body["inbound_mode"] == "webhook"

            saved = client.put(
                "/mailbox-settings",
                json={
                    "display_name": "Корпоративная почта",
                    "email_address": "itd@example.com",
                    "smtp_enabled": True,
                    "smtp_host": "smtp.mail.ru",
                    "smtp_port": 465,
                    "smtp_from": "itd@example.com",
                    "smtp_password": "super-secret",
                    "inbound_webhook_secret": "hook-secret",
                    "create_lead_from_unknown": True,
                    "lead_source_label": "email",
                },
            )
            assert saved.status_code == 200, saved.text
            again = saved.json()
            assert again["smtp_host"] == "smtp.mail.ru"
            assert again["smtp_password_set"] is True
            assert again["inbound_webhook_secret_set"] is True
            assert again["create_lead_from_unknown"] is True
            assert "smtp_password" not in again
            assert "inbound_webhook_secret" not in again
    finally:
        app.dependency_overrides.pop(get_db, None)


def test_persisted_smtp_sends_without_env(monkeypatch) -> None:
    factory = _session_factory()
    _admin(factory)
    sent: list[EmailMessage] = []

    def fake_transport(config, message: EmailMessage) -> str:
        del config
        sent.append(message)
        return message["Message-ID"] or "smtp-db"

    monkeypatch.setattr(settings, "smtp_host", None)
    monkeypatch.setattr(settings, "smtp_from", None)
    monkeypatch.setattr(
        "app.communications.connectors.email.smtp_transport",
        fake_transport,
    )
    with factory() as db:
        db.add(SalesUser(id=1, name="System", is_active=True))
        db.add(
            Lead(
                id=1,
                status=LeadStatus.NEW,
                contact_name="Иван",
                email="ivan@example.com",
                responsible_id=1,
            )
        )
        db.commit()
    try:
        with _client(factory) as client:
            login_client(client, login="admin")
            saved = client.put(
                "/mailbox-settings",
                json={
                    "smtp_enabled": True,
                    "smtp_host": "smtp.test.local",
                    "smtp_from": "crm@sport-lead.local",
                },
            )
            assert saved.status_code == 200, saved.text
            response = client.post(
                "/leads/1/messages",
                json={"channel": "email", "text": "Письмо из сохранённого SMTP"},
            )
            assert response.status_code == 201, response.text
            assert response.json()["is_mock"] is False
        assert len(sent) == 1
    finally:
        app.dependency_overrides.pop(get_db, None)


def test_disabled_mailbox_smtp_stays_mock_even_with_env(monkeypatch) -> None:
    factory = _session_factory()
    _admin(factory)
    monkeypatch.setattr(settings, "smtp_host", "smtp.env.local")
    monkeypatch.setattr(settings, "smtp_from", "env@sport-lead.local")
    with factory() as db:
        db.add(SalesUser(id=1, name="System", is_active=True))
        db.add(
            Lead(
                id=1,
                status=LeadStatus.NEW,
                contact_name="Иван",
                email="ivan@example.com",
                responsible_id=1,
            )
        )
        db.commit()
    try:
        with _client(factory) as client:
            login_client(client, login="admin")
            saved = client.put("/mailbox-settings", json={"smtp_enabled": False})
            assert saved.status_code == 200, saved.text
            response = client.post(
                "/leads/1/messages",
                json={"channel": "email", "text": "Должен остаться mock"},
            )
            assert response.status_code == 201, response.text
            assert response.json()["is_mock"] is True
    finally:
        app.dependency_overrides.pop(get_db, None)


def test_inbound_unknown_sender_creates_lead_when_enabled() -> None:
    factory = _session_factory()
    _admin(factory)
    with factory() as db:
        db.add(SalesUser(id=1, name="System", is_active=True))
        db.commit()
    try:
        with _client(factory) as client:
            login_client(client, login="admin")
            saved = client.put(
                "/mailbox-settings",
                json={
                    "inbound_webhook_secret": "hook-secret",
                    "create_lead_from_unknown": True,
                    "lead_source_label": "email",
                },
            )
            assert saved.status_code == 200, saved.text
            inbound = client.post(
                "/leads/messages/inbound/email",
                json={
                    "event_id": "evt-new",
                    "message_id": "<new@mail.example>",
                    "from_email": "new.client@example.com",
                    "from_name": "Новый Клиент",
                    "text": "Хотим форму",
                    "sent_at": "2026-08-23T15:00:00Z",
                },
                headers={"X-Sport-Lead-Email-Secret": "hook-secret"},
            )
            assert inbound.status_code == 200, inbound.text
            body = inbound.json()
            assert body[0]["is_mock"] is False
            assert body[0]["direction"] == "incoming"
        with factory() as db:
            lead = db.scalar(select(Lead).where(Lead.email == "new.client@example.com"))
            assert lead is not None
            assert lead.contact_name == "Новый Клиент"
            assert lead.source == "email"
            assert db.scalar(select(func.count()).select_from(LeadMessage)) == 1
    finally:
        app.dependency_overrides.pop(get_db, None)
