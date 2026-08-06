"""v1.00 / 0.4.2 — create SalesOrder without Lead."""

from __future__ import annotations

from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.database.base import Base
from app.database.session import get_db
from app.main import app
from app.models.sales import (
    Client,
    Lead,
    LeadResult,
    LeadStatus,
    Organization,
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
        db.add(SalesUser(id=1, name="Manager"))
        db.add(Client(id=1, company_name="Client Co", contact_name="Ivan", responsible_id=1))
        db.add(Organization(id=1, name="Org Co", is_active=True))
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


def test_create_order_without_lead_auto_number(client: TestClient) -> None:
    response = client.post(
        "/orders",
        json={
            "client_id": 1,
            "organization_id": 1,
            "responsible_id": 1,
            "title": "Manual order",
        },
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["lead_id"] is None
    assert body["title"] == "Manual order"
    assert body["number"].startswith("SO-")
    assert body["client_id"] == 1
    assert body["organization_id"] == 1
    assert body["responsible_id"] == 1


def test_create_order_without_organization(client: TestClient) -> None:
    response = client.post(
        "/orders",
        json={
            "client_id": 1,
            "responsible_id": 1,
            "title": "Order without org",
        },
    )
    assert response.status_code == 201, response.text
    assert response.json()["organization_id"] is None
    assert response.json()["lead_id"] is None


def test_create_order_without_lead_freeform_number(client: TestClient) -> None:
    response = client.post(
        "/orders",
        json={
            "client_id": 1,
            "organization_id": 1,
            "responsible_id": 1,
            "title": "UNF import prep",
            "number": "ЗК-2026-001",
        },
    )
    assert response.status_code == 201, response.text
    assert response.json()["number"] == "ЗК-2026-001"
    assert response.json()["lead_id"] is None

    conflict = client.post(
        "/orders",
        json={
            "client_id": 1,
            "organization_id": 1,
            "responsible_id": 1,
            "title": "Duplicate number",
            "number": "ЗК-2026-001",
        },
    )
    assert conflict.status_code == 409


def test_create_order_requires_refs(client: TestClient) -> None:
    response = client.post(
        "/orders",
        json={
            "client_id": 999,
            "organization_id": 1,
            "responsible_id": 1,
            "title": "Missing client",
        },
    )
    assert response.status_code == 400


def test_source_lead_and_history_without_lead(client: TestClient) -> None:
    created = client.post(
        "/orders",
        json={
            "client_id": 1,
            "organization_id": 1,
            "responsible_id": 1,
            "title": "No lead",
        },
    ).json()
    order_id = created["id"]
    assert client.get(f"/orders/{order_id}/source-lead").status_code == 404
    history = client.get(f"/orders/{order_id}/history")
    assert history.status_code == 200
    assert history.json() == []


def test_convert_lead_still_sets_lead_id(
    client: TestClient, session_factory: sessionmaker[Session]
) -> None:
    with session_factory() as db:
        lead = Lead(
            contact_name="Buyer",
            company_name="Client Co",
            phone="+79990000000",
            email="buyer@test.local",
            city="Moscow",
            source="website",
            responsible_id=1,
            need_description="Kits",
            estimated_quantity=10,
            estimated_amount=Decimal("1000.00"),
        )
        db.add(lead)
        db.commit()
        lead_id = lead.id
        lead, order = convert_lead(db, lead_id, LeadConvertRequest(completed_by_id=1))
        db.commit()
        assert order.lead_id == lead_id
        assert lead.result == LeadResult.CONVERTED
        assert lead.status == LeadStatus.COMPLETED
        assert order.number.startswith("SO-")
        assert db.scalar(select(SalesOrder.id).where(SalesOrder.lead_id == lead_id)) == order.id


def test_create_client_with_inn_ogrn(client: TestClient) -> None:
    response = client.post(
        "/clients",
        json={
            "contact_name": "ООО Ромашка",
            "company_name": "ООО Ромашка",
            "organization_name": "ООО Ромашка",
            "tax_id": "7701234567",
            "ogrn": "1027700132195",
            "responsible_id": 1,
        },
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["organization_id"] is not None
    orgs = client.get("/organizations")
    assert orgs.status_code == 200
    org = next(item for item in orgs.json() if item["id"] == body["organization_id"])
    assert org["tax_id"] == "7701234567"
    assert org["ogrn"] == "1027700132195"

    response = client.post(
        "/clients",
        json={
            "contact_name": "Новый контакт",
            "company_name": "Новая Орг ООО",
            "responsible_id": 1,
        },
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["organization_id"] is None
    assert body["company_name"] == "Новая Орг ООО"

    with_org = client.post(
        "/clients",
        json={
            "contact_name": "С орг",
            "company_name": "Клиент С орг",
            "organization_name": "ООО Явная",
            "responsible_id": 1,
        },
    )
    assert with_org.status_code == 201, with_org.text
    assert with_org.json()["organization_id"] is not None


def test_patch_status_order_without_lead_writes_history(client: TestClient) -> None:
    created = client.post(
        "/orders",
        json={
            "client_id": 1,
            "organization_id": 1,
            "responsible_id": 1,
            "title": "Status without lead",
        },
    )
    assert created.status_code == 201, created.text
    order_id = created.json()["id"]
    assert created.json()["lead_id"] is None

    patched = client.patch(f"/orders/{order_id}/status", json={"status": "confirmed"})
    assert patched.status_code == 200, patched.text
    assert patched.json()["status"] == "confirmed"

    history = client.get(f"/orders/{order_id}/history")
    assert history.status_code == 200, history.text
    events = history.json()
    assert any(event["event_type"] == "order_status_changed" for event in events)
    status_event = next(event for event in events if event["event_type"] == "order_status_changed")
    assert status_event["lead_id"] is None
    assert status_event["order_id"] == order_id


def test_client_default_organization_from_last_order(
    client: TestClient, session_factory: sessionmaker[Session]
) -> None:
    with session_factory() as db:
        bare = Client(contact_name="Без орг", company_name=None, responsible_id=1)
        db.add(bare)
        db.flush()
        db.add(
            SalesOrder(
                number="SO-ORG-HINT",
                lead_id=None,
                client_id=bare.id,
                organization_id=1,
                responsible_id=1,
                title="Hint org",
            )
        )
        db.commit()
        client_id = bare.id

    detail = client.get(f"/clients/{client_id}")
    assert detail.status_code == 200
    assert detail.json()["organization_id"] is None
    assert detail.json()["default_organization_id"] == 1
