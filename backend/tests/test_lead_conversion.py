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
    Client,
    Organization,
    Lead,
    LeadRejectionReason,
    LeadResult,
    LeadStatus,
    LeadTask,
    LeadTaskStatus,
    SalesOrder,
    SalesOrderItem,
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
            "direction": "Спортивная форма",
            "sport": "Волейбол",
            "product_category": "Игровая форма",
            "product_type": "Игровой комплект",
            "need_description": "Комплекты для двух команд",
            "estimated_quantity": 36,
            "kit_quantity": 3,
            "size_comment": "XS-XL",
            "preliminary_budget": "300000.00",
            "estimated_amount": "315000.50",
            "discount_percent": "7.50",
            "probability": "70",
            "planned_order_date": "2026-09-01",
            "desired_date": "2026-09-15",
            "event_date": "2026-09-30",
            "delivery_city": "Самара",
            "delivery_address": "ул. Спортивная, 1",
            "delivery_method": "Курьер",
            "delivery_comment": "После 18:00",
            "campaign": "fall-teamwear",
            "utm_description": "utm_source=vk&utm_campaign=fall",
            "priority": "high",
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["estimated_amount"] == "315000.50"
    assert body["preliminary_budget"] == "300000.00"
    assert body["discount_percent"] == "7.50"
    assert body["probability"] == "70.00"
    assert body["desired_date"] == "2026-09-15"
    assert body["delivery_city"] == "Самара"
    assert body["city"] == "Казань"

    reloaded = client.get(f"/leads/{lead_id}")
    assert reloaded.status_code == 200
    assert reloaded.json()["delivery_address"] == "ул. Спортивная, 1"
    assert reloaded.json()["priority"] == "high"
    assert reloaded.json()["city"] == "Казань"

    with session_factory() as db:
        lead = db.get(Lead, lead_id)
        assert lead is not None
        assert lead.source == "referral"
        assert lead.direction == "Спортивная форма"
        assert lead.sport == "Волейбол"
        assert lead.product_category == "Игровая форма"
        assert lead.product_type == "Игровой комплект"
        assert lead.need_description == "Комплекты для двух команд"
        assert lead.estimated_quantity == 36
        assert lead.kit_quantity == 3
        assert lead.size_comment == "XS-XL"
        assert lead.preliminary_budget == Decimal("300000.00")
        assert lead.estimated_amount == Decimal("315000.50")
        assert lead.discount_percent == Decimal("7.50")
        assert lead.probability == Decimal("70.00")
        assert lead.planned_order_date == date(2026, 9, 1)
        assert lead.desired_date == date(2026, 9, 15)
        assert lead.event_date == date(2026, 9, 30)
        assert lead.delivery_city == "Самара"
        assert lead.city == "Казань"
        assert lead.delivery_address == "ул. Спортивная, 1"
        assert lead.delivery_method == "Курьер"
        assert lead.delivery_comment == "После 18:00"
        assert lead.campaign == "fall-teamwear"
        assert lead.utm_description == "utm_source=vk&utm_campaign=fall"
        assert lead.priority == "high"

    cleared = client.patch(
        f"/leads/{lead_id}",
        json={
            "direction": None,
            "sport": None,
            "product_category": None,
            "product_type": None,
            "need_description": None,
            "estimated_quantity": None,
            "kit_quantity": None,
            "size_comment": None,
            "preliminary_budget": None,
            "estimated_amount": None,
            "discount_percent": None,
            "probability": None,
            "planned_order_date": None,
            "desired_date": None,
            "event_date": None,
            "delivery_city": None,
            "delivery_address": None,
            "delivery_method": None,
            "delivery_comment": None,
            "campaign": None,
            "utm_description": None,
            "priority": None,
        },
    )
    assert cleared.status_code == 200
    assert cleared.json()["direction"] is None
    assert cleared.json()["sport"] is None
    assert cleared.json()["product_category"] is None
    assert cleared.json()["product_type"] is None
    assert cleared.json()["need_description"] is None
    assert cleared.json()["estimated_quantity"] is None
    assert cleared.json()["kit_quantity"] is None
    assert cleared.json()["size_comment"] is None
    assert cleared.json()["preliminary_budget"] is None
    assert cleared.json()["estimated_amount"] is None
    assert cleared.json()["discount_percent"] is None
    assert cleared.json()["probability"] is None
    assert cleared.json()["planned_order_date"] is None
    assert cleared.json()["desired_date"] is None
    assert cleared.json()["event_date"] is None
    assert cleared.json()["delivery_city"] is None
    assert cleared.json()["delivery_address"] is None
    assert cleared.json()["delivery_method"] is None
    assert cleared.json()["delivery_comment"] is None
    assert cleared.json()["campaign"] is None
    assert cleared.json()["utm_description"] is None
    assert cleared.json()["priority"] is None

    cleared_reload = client.get(f"/leads/{lead_id}")
    assert cleared_reload.status_code == 200
    assert cleared_reload.json()["delivery_city"] is None
    assert cleared_reload.json()["city"] == "Казань"


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


def test_lead_responsible_patch_persists_clears_and_validates(
    client: TestClient,
    session_factory: sessionmaker[Session],
) -> None:
    lead_id = add_lead(session_factory)

    cleared = client.patch(f"/leads/{lead_id}", json={"responsible_id": None})
    assert cleared.status_code == 200
    assert cleared.json()["responsible_id"] is None
    assert client.get(f"/leads/{lead_id}").json()["responsible_id"] is None

    assigned = client.patch(f"/leads/{lead_id}", json={"responsible_id": 1})
    assert assigned.status_code == 200
    assert assigned.json()["responsible_id"] == 1
    assert client.get(f"/leads/{lead_id}").json()["responsible_id"] == 1

    missing = client.patch(f"/leads/{lead_id}", json={"responsible_id": 999})
    assert missing.status_code == 404


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


def test_orders_list_exposes_converted_order_for_reload(
    client: TestClient,
    session_factory: sessionmaker[Session],
) -> None:
    lead_id = add_lead(session_factory)
    conversion = client.post(f"/leads/{lead_id}/convert", json={"completed_by_id": 1})
    assert conversion.status_code == 201
    order = conversion.json()["order"]

    response = client.get("/orders")
    assert response.status_code == 200
    listed = next(item for item in response.json() if item["id"] == order["id"])
    assert listed["number"] == order["number"]
    assert listed["lead_id"] == lead_id
    with session_factory() as db:
        client_row = db.get(Client, order["client_id"])
        assert client_row is not None
        assert listed["client_name"] == (client_row.company_name or client_row.contact_name)
    assert listed["responsible_name"] == "Test user"


def test_order_detail_exposes_conversion_links_and_nullable_fields(
    client: TestClient,
    session_factory: sessionmaker[Session],
) -> None:
    lead_id = add_lead(session_factory)
    conversion = client.post(f"/leads/{lead_id}/convert", json={"completed_by_id": 1})
    assert conversion.status_code == 201
    created_order = conversion.json()["order"]

    response = client.get(f"/orders/{created_order['id']}")
    assert response.status_code == 200
    order = response.json()
    assert order["id"] == created_order["id"]
    assert order["lead_id"] == lead_id
    assert order["client_id"] == created_order["client_id"]
    assert order["client_name"] == "СК Олимп"
    assert order["responsible_name"] == "Test user"
    assert order["description"] == "Форма для команды"
    assert order["desired_date"] is None
    assert order["created_at"]
    assert order["updated_at"]


def test_order_conversion_creates_and_exposes_organization(
    client: TestClient,
    session_factory: sessionmaker[Session],
) -> None:
    lead_id = add_lead(session_factory)
    conversion = client.post(f"/leads/{lead_id}/convert", json={"completed_by_id": 1})
    assert conversion.status_code == 201
    order_id = conversion.json()["order"]["id"]

    detail = client.get(f"/orders/{order_id}")
    assert detail.status_code == 200
    assert detail.json()["organization_id"] is not None
    assert detail.json()["organization_name"] == "СК Олимп"

    organizations = client.get("/organizations")
    assert organizations.status_code == 200
    organization = next(item for item in organizations.json() if item["id"] == detail.json()["organization_id"])
    assert organization["name"] == "СК Олимп"

    with session_factory() as db:
        assert db.scalar(select(func.count()).select_from(Organization)) == 1


def test_order_organization_patch_accepts_active_organization_and_rejects_missing_one(
    client: TestClient,
    session_factory: sessionmaker[Session],
) -> None:
    lead_id = add_lead(session_factory)
    order_id = client.post(f"/leads/{lead_id}/convert", json={"completed_by_id": 1}).json()["order"]["id"]
    with session_factory() as db:
        organization = db.scalar(select(Organization))
        assert organization is not None
        organization_id = organization.id

    cleared = client.patch(f"/orders/{order_id}/organization", json={"organization_id": None})
    assert cleared.status_code == 200
    assert cleared.json()["organization_id"] is None

    restored = client.patch(f"/orders/{order_id}/organization", json={"organization_id": organization_id})
    assert restored.status_code == 200
    assert restored.json()["organization_id"] == organization_id

    missing = client.patch(f"/orders/{order_id}/organization", json={"organization_id": 999999})
    assert missing.status_code == 404


def test_order_detail_returns_404_for_missing_order(client: TestClient) -> None:
    response = client.get("/orders/999999")
    assert response.status_code == 404


def test_order_status_patch_persists_after_reload(
    client: TestClient,
    session_factory: sessionmaker[Session],
) -> None:
    lead_id = add_lead(session_factory)
    conversion = client.post(f"/leads/{lead_id}/convert", json={"completed_by_id": 1})
    order_id = conversion.json()["order"]["id"]

    updated = client.patch(f"/orders/{order_id}/status", json={"status": "production"})
    assert updated.status_code == 200
    assert updated.json()["status"] == "production"
    assert updated.json()["client_name"] == "СК Олимп"

    reloaded = client.get(f"/orders/{order_id}")
    assert reloaded.status_code == 200
    assert reloaded.json()["status"] == "production"

    history = client.get(f"/orders/{order_id}/history")
    assert history.status_code == 200
    assert history.json()[-1]["event_type"] == "order_status_changed"
    assert history.json()[-1]["message"] == "Order status changed: new → production"


def test_order_status_patch_validates_status_and_missing_order(client: TestClient) -> None:
    invalid_status = client.patch("/orders/999999/status", json={"status": "unknown"})
    assert invalid_status.status_code == 422

    missing_order = client.patch("/orders/999999/status", json={"status": "production"})
    assert missing_order.status_code == 404


def test_order_status_patch_rejects_backward_and_terminal_transitions(
    client: TestClient,
    session_factory: sessionmaker[Session],
) -> None:
    lead_id = add_lead(session_factory)
    order_id = client.post(f"/leads/{lead_id}/convert", json={"completed_by_id": 1}).json()["order"]["id"]

    assert client.patch(f"/orders/{order_id}/status", json={"status": "production"}).status_code == 200
    backward = client.patch(f"/orders/{order_id}/status", json={"status": "confirmed"})
    assert backward.status_code == 409

    assert client.patch(f"/orders/{order_id}/status", json={"status": "completed"}).status_code == 200
    terminal = client.patch(f"/orders/{order_id}/status", json={"status": "cancelled"})
    assert terminal.status_code == 409


def test_order_items_are_crud_persistent_and_recalculate_order_total(
    client: TestClient,
    session_factory: sessionmaker[Session],
) -> None:
    lead_id = add_lead(session_factory)
    order_id = client.post(f"/leads/{lead_id}/convert", json={"completed_by_id": 1}).json()["order"]["id"]
    created = client.post(
        f"/orders/{order_id}/items",
        json={"snapshot_name": "Футболка", "unit": "шт", "quantity": "2", "unit_price": "1500"},
    )
    assert created.status_code == 201
    assert created.json()["line_amount"] == "3000.00"
    item_id = created.json()["id"]

    second = client.post(
        f"/orders/{order_id}/items",
        json={"snapshot_name": "Шорты", "unit": "шт", "quantity": "2", "unit_price": "750"},
    )
    assert second.status_code == 201
    assert client.get(f"/orders/{order_id}/items").json()[0]["position"] == 1
    assert client.get(f"/orders/{order_id}").json()["amount"] == "4500.00"

    updated = client.patch(
        f"/orders/{order_id}/items/{item_id}",
        json={"quantity": "3", "unit_price": "1600"},
    )
    assert updated.status_code == 200
    assert updated.json()["line_amount"] == "4800.00"
    assert client.get(f"/orders/{order_id}").json()["amount"] == "6300.00"

    deleted = client.delete(f"/orders/{order_id}/items/{item_id}")
    assert deleted.status_code == 204
    assert client.get(f"/orders/{order_id}").json()["amount"] == "1500.00"
    with session_factory() as db:
        assert db.scalar(select(func.count()).select_from(SalesOrderItem)) == 1
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
