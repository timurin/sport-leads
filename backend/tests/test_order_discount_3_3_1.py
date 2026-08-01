"""Stage 3.3.1 — order-level discount percent."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.database.base import Base
from app.database.session import get_db
from app.main import app
from app.models.characteristics import NomenclatureVariant  # noqa: F401
from app.models.media import NomenclatureMedia  # noqa: F401
from app.models.nomenclature import NomenclatureHistoryEntry  # noqa: F401
from app.models.sales import Lead, LeadRejectionReason, LeadStatus, SalesUser


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
        db.add(
            LeadRejectionReason(
                id=1,
                code="no_budget",
                name="Нет бюджета",
                category="Клиент",
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


def add_lead(session_factory: sessionmaker[Session]) -> int:
    with session_factory() as db:
        lead = Lead(contact_name="Discount lead", status=LeadStatus.NEW, responsible_id=1)
        db.add(lead)
        db.commit()
        return lead.id


def test_order_discount_recalculates_amount(
    client: TestClient, session_factory: sessionmaker[Session]
) -> None:
    order_id = client.post(
        f"/leads/{add_lead(session_factory)}/convert",
        json={"completed_by_id": 1},
    ).json()["order"]["id"]
    item = client.post(
        f"/orders/{order_id}/items",
        json={
            "snapshot_name": "Jersey",
            "unit": "шт",
            "quantity": "2",
            "unit_price": "100.00",
            "discount_percent": "10",
        },
    )
    assert item.status_code == 201, item.text
    assert item.json()["line_amount"] == "180.00"

    patched = client.patch(
        f"/orders/{order_id}/discount",
        json={"discount_percent": "10"},
    )
    assert patched.status_code == 200, patched.text
    body = patched.json()
    assert body["items_subtotal"] == "180.00"
    assert body["discount_percent"] == "10.00"
    assert body["discount_amount"] == "18.00"
    assert body["amount"] == "162.00"

    cleared = client.patch(
        f"/orders/{order_id}/discount",
        json={"discount_percent": None},
    )
    assert cleared.status_code == 200
    assert cleared.json()["discount_amount"] == "0.00"
    assert cleared.json()["amount"] == "180.00"


def test_order_discount_rejects_out_of_range(
    client: TestClient, session_factory: sessionmaker[Session]
) -> None:
    order_id = client.post(
        f"/leads/{add_lead(session_factory)}/convert",
        json={"completed_by_id": 1},
    ).json()["order"]["id"]
    bad = client.patch(
        f"/orders/{order_id}/discount",
        json={"discount_percent": "101"},
    )
    assert bad.status_code == 422


def test_order_discount_recalculates_when_line_changes(
    client: TestClient, session_factory: sessionmaker[Session]
) -> None:
    order_id = client.post(
        f"/leads/{add_lead(session_factory)}/convert",
        json={"completed_by_id": 1},
    ).json()["order"]["id"]
    item = client.post(
        f"/orders/{order_id}/items",
        json={
            "snapshot_name": "Jersey",
            "unit": "шт",
            "quantity": "1",
            "unit_price": "1000.00",
        },
    ).json()
    assert (
        client.patch(
            f"/orders/{order_id}/discount",
            json={"discount_percent": "20"},
        ).status_code
        == 200
    )
    before = client.get(f"/orders/{order_id}").json()
    assert before["items_subtotal"] == "1000.00"
    assert before["discount_amount"] == "200.00"
    assert before["amount"] == "800.00"

    patched_item = client.patch(
        f"/orders/{order_id}/items/{item['id']}",
        json={"quantity": "2"},
    )
    assert patched_item.status_code == 200, patched_item.text
    assert patched_item.json()["line_amount"] == "2000.00"

    after = client.get(f"/orders/{order_id}").json()
    assert after["items_subtotal"] == "2000.00"
    assert after["discount_percent"] == "20.00"
    assert after["discount_amount"] == "400.00"
    assert after["amount"] == "1600.00"
