from fastapi.testclient import TestClient
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.collectors.factory import CollectorFactory
from app.collectors.webhook_form import WEBHOOK_FORM_ADAPTER, WebhookFormCollector
from app.config.settings import settings
from app.database.base import Base
from app.database.session import get_db
from app.main import app
from app.models.sales import Lead, LeadEvent, LeadEventType, LeadIngestReceipt, SalesUser


FORM_SECRET = "test-form-secret"
FORM_PAYLOAD = {
    "external_id": "site-form-1042",
    "contact_name": "  Академия Спорт  ",
    "phone": "+79990001122",
    "email": "academy@example.com",
    "company_name": "Академия Спорт",
    "city": "Казань",
    "comment": "Нужна форма на 20 комплектов",
    "source": "website",
    "sport": "футбол",
}


def _session_factory() -> sessionmaker[Session]:
    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, expire_on_commit=False)
    with factory() as db:
        db.add(SalesUser(id=1, name="Test user"))
        db.commit()
    return factory


def _client(session_factory: sessionmaker[Session], monkeypatch) -> TestClient:
    monkeypatch.setattr(settings, "lead_form_webhook_secret", FORM_SECRET)

    def override_get_db():
        with session_factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    return TestClient(app)


def test_factory_registers_webhook_form_not_sport_event_collect() -> None:
    assert WEBHOOK_FORM_ADAPTER in CollectorFactory.supported_types()
    collector = CollectorFactory.create(WEBHOOK_FORM_ADAPTER)
    assert isinstance(collector, WebhookFormCollector)
    normalized = collector.normalize(FORM_PAYLOAD)
    assert normalized.adapter_type == WEBHOOK_FORM_ADAPTER
    assert normalized.external_id == "site-form-1042"
    assert normalized.contact_name == "Академия Спорт"
    assert normalized.source_label == "website"


def test_website_form_ingest_creates_lead_receipt_and_event(monkeypatch) -> None:
    factory = _session_factory()
    with _client(factory, monkeypatch) as client:
        response = client.post(
            "/leads/ingest/website-form",
            json=FORM_PAYLOAD,
            headers={"X-Sport-Lead-Ingest-Secret": FORM_SECRET},
        )
        assert response.status_code == 200
        body = response.json()
        assert body["created"] is True
        assert body["duplicate_ingest"] is False
        assert body["matched_existing"] is False
        assert body["lead"]["contact_name"] == "Академия Спорт"
        assert body["lead"]["source"] == "website"
        assert body["lead"]["customer_comment"] == "Нужна форма на 20 комплектов"
        lead_id = body["lead"]["id"]

    with factory() as db:
        assert db.scalar(select(func.count()).select_from(Lead)) == 1
        receipt = db.scalar(select(LeadIngestReceipt))
        assert receipt is not None
        assert receipt.adapter_type == WEBHOOK_FORM_ADAPTER
        assert receipt.external_id == "site-form-1042"
        assert receipt.lead_id == lead_id
        events = list(db.scalars(select(LeadEvent).where(LeadEvent.lead_id == lead_id)))
        types = {event.event_type for event in events}
        assert LeadEventType.LEAD_CREATED in types
        assert LeadEventType.COMMENT_ADDED in types


def test_website_form_ingest_is_idempotent_on_external_id(monkeypatch) -> None:
    factory = _session_factory()
    with _client(factory, monkeypatch) as client:
        first = client.post(
            "/leads/ingest/website-form",
            json=FORM_PAYLOAD,
            headers={"X-Sport-Lead-Ingest-Secret": FORM_SECRET},
        )
        second = client.post(
            "/leads/ingest/website-form",
            json={**FORM_PAYLOAD, "contact_name": "Другое имя"},
            headers={"X-Sport-Lead-Ingest-Secret": FORM_SECRET},
        )
        assert first.status_code == 200
        assert second.status_code == 200
        assert second.json()["created"] is False
        assert second.json()["duplicate_ingest"] is True
        assert second.json()["lead"]["id"] == first.json()["lead"]["id"]
        assert second.json()["lead"]["contact_name"] == "Академия Спорт"

    with factory() as db:
        assert db.scalar(select(func.count()).select_from(Lead)) == 1
        assert db.scalar(select(func.count()).select_from(LeadIngestReceipt)) == 1


def test_website_form_ingest_matches_existing_phone(monkeypatch) -> None:
    factory = _session_factory()
    with _client(factory, monkeypatch) as client:
        created = client.post(
            "/leads",
            json={
                "contact_name": "Существующий",
                "phone": "+79990001122",
                "source": "manual",
            },
        )
        assert created.status_code == 201
        existing_id = created.json()["id"]
        ingested = client.post(
            "/leads/ingest/website-form",
            json={**FORM_PAYLOAD, "external_id": "site-form-9999"},
            headers={"X-Sport-Lead-Ingest-Secret": FORM_SECRET},
        )
        assert ingested.status_code == 200
        body = ingested.json()
        assert body["created"] is False
        assert body["matched_existing"] is True
        assert body["lead"]["id"] == existing_id

    with factory() as db:
        assert db.scalar(select(func.count()).select_from(Lead)) == 1


def test_website_form_ingest_rejects_bad_or_missing_secret(monkeypatch) -> None:
    factory = _session_factory()
    with _client(factory, monkeypatch) as client:
        missing = client.post("/leads/ingest/website-form", json=FORM_PAYLOAD)
        assert missing.status_code == 401
        wrong = client.post(
            "/leads/ingest/website-form",
            json=FORM_PAYLOAD,
            headers={"X-Sport-Lead-Ingest-Secret": "nope"},
        )
        assert wrong.status_code == 401

    monkeypatch.setattr(settings, "lead_form_webhook_secret", None)

    def override_get_db():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as client:
        unavailable = client.post(
            "/leads/ingest/website-form",
            json=FORM_PAYLOAD,
            headers={"X-Sport-Lead-Ingest-Secret": FORM_SECRET},
        )
        assert unavailable.status_code == 503
    app.dependency_overrides.clear()
