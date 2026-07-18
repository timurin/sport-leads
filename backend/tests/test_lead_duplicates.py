import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.database.base import Base
from app.database.session import get_db
from app.main import app
from app.models.sales import Lead, LeadContact


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


def add_lead_with_contact(session_factory: sessionmaker[Session]) -> int:
    with session_factory() as db:
        lead = Lead(
            contact_name="Анна Смирнова",
            phone="+7 (999) 000-00-01",
            email="ANNA@example.com",
        )
        lead.contacts.append(
            LeadContact(
                name="Иван Петров",
                phone="8 999 000 00 02",
                email="ivan@example.com",
                is_primary=True,
            )
        )
        db.add(lead)
        db.commit()
        return lead.id


def test_duplicate_candidates_match_lead_and_contact_email_phone(
    client: TestClient,
    session_factory: sessionmaker[Session],
) -> None:
    lead_id = add_lead_with_contact(session_factory)

    by_lead_email = client.get("/leads/duplicate-candidates", params={"email": "anna@example.com"})
    assert by_lead_email.status_code == 200
    assert [item["id"] for item in by_lead_email.json()] == [lead_id]

    by_contact_email = client.get(
        "/leads/duplicate-candidates",
        params={"email": "ivan@example.com"},
    )
    assert by_contact_email.status_code == 200
    assert [item["id"] for item in by_contact_email.json()] == [lead_id]

    by_lead_phone = client.get(
        "/leads/duplicate-candidates",
        params={"phone": "8 999 000 00 01"},
    )
    assert by_lead_phone.status_code == 200
    assert [item["id"] for item in by_lead_phone.json()] == [lead_id]

    by_contact_phone = client.get(
        "/leads/duplicate-candidates",
        params={"phone": "+7 999 000 00 02"},
    )
    assert by_contact_phone.status_code == 200
    assert [item["id"] for item in by_contact_phone.json()] == [lead_id]


def test_duplicate_candidates_validate_criteria_and_exclusion(
    client: TestClient,
    session_factory: sessionmaker[Session],
) -> None:
    lead_id = add_lead_with_contact(session_factory)

    missing_criteria = client.get("/leads/duplicate-candidates")
    assert missing_criteria.status_code == 422

    excluded = client.get(
        "/leads/duplicate-candidates",
        params={"phone": "+79990000001", "exclude_lead_id": lead_id},
    )
    assert excluded.status_code == 200
    assert excluded.json() == []
