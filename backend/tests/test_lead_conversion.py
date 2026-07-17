from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.database.base import Base
from app.database.session import get_db
from app.main import app
from app.models.sales import (
    Lead,
    LeadRejectionReason,
    LeadResult,
    LeadStatus,
    LeadTask,
    LeadTaskStatus,
    SalesOrder,
    SalesUser,
)
from app.schemas.sales import LeadConvertRequest
from app.services.lead_conversion import convert_lead


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
        db.add_all(
            [
                LeadRejectionReason(
                    id=1,
                    code="no_budget",
                    name="Нет бюджета",
                    category="Клиент",
                ),
                LeadRejectionReason(
                    id=2,
                    code="other",
                    name="Другое",
                    category="Качество лида",
                    requires_comment=True,
                ),
                LeadRejectionReason(
                    id=3,
                    code="inactive",
                    name="Неактивная",
                    category="Клиент",
                    is_active=False,
                ),
            ]
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


def add_lead(session_factory: sessionmaker[Session]) -> int:
    with session_factory() as db:
        lead = Lead(
            contact_name="Иван Петров",
            company_name="СК Олимп",
            phone="+79990000000",
            email="sales@example.com",
            city="Казань",
            source="website",
            responsible_id=1,
            sport="Футбол",
            product_category="Форма",
            need_description="Форма для команды",
            estimated_quantity=25,
            estimated_amount=Decimal("250000"),
        )
        db.add(lead)
        db.flush()
        db.add(LeadTask(lead_id=lead.id, title="Позвонить клиенту"))
        db.commit()
        return lead.id


def test_conversion_creates_one_linked_order_and_is_not_repeatable(
    client: TestClient,
    session_factory: sessionmaker[Session],
) -> None:
    lead_id = add_lead(session_factory)
    response = client.post(f"/leads/{lead_id}/convert", json={"completed_by_id": 1})
    assert response.status_code == 201
    body = response.json()
    assert body["lead"]["result"] == "converted"
    assert body["lead"]["status"] == "completed"
    assert body["lead"]["converted_order_id"] == body["order"]["id"]
    assert body["order"]["lead_id"] == lead_id
    assert body["order"]["source"] == "website"
    assert body["order"]["amount"] == "250000.00"

    repeated = client.post(f"/leads/{lead_id}/convert", json={"completed_by_id": 1})
    assert repeated.status_code == 409
    rejected = client.post(
        f"/leads/{lead_id}/reject",
        json={"rejection_reason_id": 1, "completed_by_id": 1},
    )
    assert rejected.status_code == 409
    with session_factory() as db:
        assert db.scalar(select(func.count()).select_from(SalesOrder)) == 1


def test_conversion_rollback_keeps_lead_active(
    session_factory: sessionmaker[Session],
) -> None:
    lead_id = add_lead(session_factory)
    with session_factory() as db:
        convert_lead(db, lead_id, LeadConvertRequest(completed_by_id=1))
        db.rollback()
    with session_factory() as db:
        lead = db.get(Lead, lead_id)
        assert lead is not None
        assert lead.status == LeadStatus.NEW
        assert lead.result is None
        assert db.scalar(select(func.count()).select_from(SalesOrder)) == 0


def test_rejection_validates_reason_comment_and_cancels_open_tasks(
    client: TestClient,
    session_factory: sessionmaker[Session],
) -> None:
    lead_id = add_lead(session_factory)
    missing_reason = client.post(
        f"/leads/{lead_id}/reject",
        json={"rejection_reason_id": 999, "completed_by_id": 1},
    )
    assert missing_reason.status_code == 409
    missing_comment = client.post(
        f"/leads/{lead_id}/reject",
        json={"rejection_reason_id": 2, "completed_by_id": 1},
    )
    assert missing_comment.status_code == 409
    inactive = client.post(
        f"/leads/{lead_id}/reject",
        json={"rejection_reason_id": 3, "completed_by_id": 1},
    )
    assert inactive.status_code == 409

    response = client.post(
        f"/leads/{lead_id}/reject",
        json={
            "rejection_reason_id": 2,
            "comment": "Клиенту нужен другой вид продукции",
            "completed_by_id": 1,
        },
    )
    assert response.status_code == 200
    assert response.json()["result"] == "rejected"
    with session_factory() as db:
        task = db.scalar(select(LeadTask).where(LeadTask.lead_id == lead_id))
        assert task is not None
        assert task.status == LeadTaskStatus.CANCELLED

    converted = client.post(f"/leads/{lead_id}/convert", json={"completed_by_id": 1})
    assert converted.status_code == 409


def test_order_exposes_source_lead_and_combined_history(
    client: TestClient,
    session_factory: sessionmaker[Session],
) -> None:
    lead_id = add_lead(session_factory)
    conversion = client.post(f"/leads/{lead_id}/convert", json={"completed_by_id": 1})
    order_id = conversion.json()["order"]["id"]
    source = client.get(f"/orders/{order_id}/source-lead")
    history = client.get(f"/orders/{order_id}/history")
    assert source.status_code == 200
    assert source.json()["id"] == lead_id
    assert history.status_code == 200
    assert {item["event_type"] for item in history.json()} == {
        "lead_converted",
        "order_created",
    }
