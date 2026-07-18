from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.database.base import Base
from app.database.session import get_db
from app.main import app
from app.models.sales import Lead, LeadContact, LeadEvent, LeadEventType, LeadStatus, SalesUser


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
        db.add(SalesUser(id=1, name="Test user"))
        db.add(SalesUser(id=2, name="Inactive user", is_active=False))
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


def test_create_lead_persists_primary_contact_event_and_reload(
    client: TestClient,
    session_factory: sessionmaker[Session],
) -> None:
    response = client.post(
        "/leads",
        json={
            "contact_name": "  Анна Смирнова  ",
            "company_name": "СК Вектор",
            "phone": "+79990000001",
            "email": "anna@example.com",
            "city": "Самара",
            "source": "website",
            "responsible_id": 1,
            "estimated_amount": "125000.50",
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert body["status"] == LeadStatus.NEW.value
    assert body["result"] is None
    assert body["contact_name"] == "Анна Смирнова"
    assert body["estimated_amount"] == "125000.50"
    assert len(body["contacts"]) == 1
    assert body["contacts"][0]["is_primary"] is True

    lead_id = body["id"]
    reloaded = client.get(f"/leads/{lead_id}")
    assert reloaded.status_code == 200
    assert reloaded.json()["contact_name"] == "Анна Смирнова"

    listed = client.get("/leads").json()
    assert any(item["id"] == lead_id for item in listed)

    with session_factory() as db:
        lead = db.get(Lead, lead_id)
        assert lead is not None
        assert lead.estimated_amount == Decimal("125000.50")
        assert db.scalar(
            select(func.count()).select_from(LeadContact).where(
                LeadContact.lead_id == lead_id,
                LeadContact.is_primary.is_(True),
            )
        ) == 1
        event = db.scalar(select(LeadEvent).where(LeadEvent.lead_id == lead_id))
        assert event is not None
        assert event.event_type == LeadEventType.LEAD_CREATED


def test_create_lead_validates_payload_and_responsible(client: TestClient) -> None:
    assert client.post("/leads", json={"contact_name": "   "}).status_code == 422
    assert client.post(
        "/leads",
        json={"contact_name": "Иван", "estimated_amount": "-1"},
    ).status_code == 422
    assert client.post(
        "/leads",
        json={"contact_name": "Иван", "email": "not-an-email"},
    ).status_code == 422
    assert client.post(
        "/leads",
        json={"contact_name": "Иван", "responsible_id": 999},
    ).status_code == 404
    assert client.post(
        "/leads",
        json={"contact_name": "Иван", "responsible_id": 2},
    ).status_code == 404
