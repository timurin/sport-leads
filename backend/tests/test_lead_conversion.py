from datetime import date
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


def test_lead_commercial_fields_patch_persists_and_clears_values(
    client: TestClient,
    session_factory: sessionmaker[Session],
) -> None:
    lead_id = add_lead(session_factory)
    response = client.patch(
        f"/leads/{lead_id}",
        json={
            "source": "referral",
            "sport": "Волейбол",
            "product_category": "Игровая форма",
            "need_description": "Комплекты для двух команд",
            "estimated_quantity": 36,
            "estimated_amount": "315000.50",
            "desired_date": "2026-09-15",
            "city": "Самара",
        },
    )
    assert response.status_code == 200
    assert response.json()["estimated_amount"] == "315000.50"
    assert response.json()["desired_date"] == "2026-09-15"

    with session_factory() as db:
        lead = db.get(Lead, lead_id)
        assert lead is not None
        assert lead.source == "referral"
        assert lead.sport == "Волейбол"
        assert lead.product_category == "Игровая форма"
        assert lead.need_description == "Комплекты для двух команд"
        assert lead.estimated_quantity == 36
        assert lead.estimated_amount == Decimal("315000.50")
        assert lead.desired_date == date(2026, 9, 15)
        assert lead.city == "Самара"

    cleared = client.patch(
        f"/leads/{lead_id}",
        json={
            "need_description": None,
            "estimated_quantity": None,
            "estimated_amount": None,
            "desired_date": None,
        },
    )
    assert cleared.status_code == 200
    assert cleared.json()["need_description"] is None
    assert cleared.json()["estimated_quantity"] is None
    assert cleared.json()["estimated_amount"] is None
    assert cleared.json()["desired_date"] is None


def test_lead_customer_profile_patch_persists_and_clears_values(
    client: TestClient,
    session_factory: sessionmaker[Session],
) -> None:
    lead_id = add_lead(session_factory)
    response = client.patch(
        f"/leads/{lead_id}",
        json={
            "customer_type": "company",
            "company_name": "ООО Спорт Лига",
            "tax_id": "1655000000",
            "website": "sport.example",
            "city": "Нижний Новгород",
            "region": "Нижегородская область",
            "address": "ул. Центральная, 1",
            "customer_comment": "Работают только по договору.",
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["customer_type"] == "company"
    assert body["tax_id"] == "1655000000"
    assert body["region"] == "Нижегородская область"

    with session_factory() as db:
        lead = db.get(Lead, lead_id)
        assert lead is not None
        assert lead.customer_type == "company"
        assert lead.company_name == "ООО Спорт Лига"
        assert lead.tax_id == "1655000000"
        assert lead.website == "sport.example"
        assert lead.city == "Нижний Новгород"
        assert lead.region == "Нижегородская область"
        assert lead.address == "ул. Центральная, 1"
        assert lead.customer_comment == "Работают только по договору."

    cleared = client.patch(
        f"/leads/{lead_id}",
        json={
            "customer_type": None,
            "tax_id": None,
            "website": None,
            "region": None,
            "address": None,
            "customer_comment": None,
        },
    )
    assert cleared.status_code == 200
    assert cleared.json()["customer_type"] is None
    assert cleared.json()["tax_id"] is None
    assert cleared.json()["website"] is None
    assert cleared.json()["region"] is None
    assert cleared.json()["address"] is None
    assert cleared.json()["customer_comment"] is None


def test_lead_customer_profile_patch_validates_tax_id(
    client: TestClient,
    session_factory: sessionmaker[Session],
) -> None:
    lead_id = add_lead(session_factory)
    response = client.patch(f"/leads/{lead_id}", json={"tax_id": "123"})
    assert response.status_code == 422


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


def test_lead_history_exposes_status_conversion_and_rejection_events(
    client: TestClient,
    session_factory: sessionmaker[Session],
) -> None:
    status_lead_id = add_lead(session_factory)
    assert client.patch(f"/leads/{status_lead_id}", json={"status": "contact"}).status_code == 200

    converted_lead_id = add_lead(session_factory)
    assert client.post(f"/leads/{converted_lead_id}/convert", json={"completed_by_id": 1}).status_code == 201

    rejected_lead_id = add_lead(session_factory)
    assert client.post(
        f"/leads/{rejected_lead_id}/reject",
        json={"rejection_reason_id": 1, "completed_by_id": 1},
    ).status_code == 200

    status_history = client.get(f"/leads/{status_lead_id}/history")
    converted_history = client.get(f"/leads/{converted_lead_id}/history")
    rejected_history = client.get(f"/leads/{rejected_lead_id}/history")
    assert status_history.status_code == converted_history.status_code == rejected_history.status_code == 200
    assert [item["event_type"] for item in status_history.json()] == ["lead_status_changed"]
    assert {item["event_type"] for item in converted_history.json()} == {"lead_converted", "order_created"}
    assert [item["event_type"] for item in rejected_history.json()] == ["lead_rejected"]
