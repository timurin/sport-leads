"""Stage 3.4.2 — payment / reserve markers and completed payment gate."""

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
from app.models.characteristics import NomenclatureVariant  # noqa: F401
from app.models.media import NomenclatureMedia  # noqa: F401
from app.models.nomenclature import NomenclatureHistoryEntry  # noqa: F401
from app.models.sales import Lead, LeadRejectionReason, LeadStatus, SalesOrder, SalesUser
from app.models.sales_commercial import SalesInvoice, SalesQuotation  # noqa: F401


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


def _convert(client: TestClient, session_factory: sessionmaker[Session]) -> int:
    with session_factory() as db:
        lead = Lead(contact_name="Exec lead", status=LeadStatus.NEW, responsible_id=1)
        db.add(lead)
        db.commit()
        lead_id = lead.id
    return client.post(
        f"/leads/{lead_id}/convert",
        json={"completed_by_id": 1},
    ).json()["order"]["id"]


def test_default_payment_and_reserve(
    client: TestClient, session_factory: sessionmaker[Session]
) -> None:
    order_id = _convert(client, session_factory)
    body = client.get(f"/orders/{order_id}").json()
    assert body["payment_status"] == "unpaid"
    assert Decimal(str(body["paid_amount"])) == Decimal("0")
    assert body["material_reserve_status"] == "not_required"


def test_payment_patch_derives_status(
    client: TestClient, session_factory: sessionmaker[Session]
) -> None:
    order_id = _convert(client, session_factory)
    with session_factory() as db:
        order = db.scalar(select(SalesOrder).where(SalesOrder.id == order_id))
        assert order is not None
        order.amount = Decimal("1000.00")
        db.commit()

    partial = client.patch(
        f"/orders/{order_id}/payment",
        json={"paid_amount": "400.00"},
    )
    assert partial.status_code == 200
    assert partial.json()["payment_status"] == "partial"

    # Stale status in body must not 409 — amount wins.
    paid = client.patch(
        f"/orders/{order_id}/payment",
        json={"paid_amount": "1000.00", "payment_status": "partial"},
    )
    assert paid.status_code == 200
    assert paid.json()["payment_status"] == "paid"


def test_completed_blocked_until_paid(
    client: TestClient, session_factory: sessionmaker[Session]
) -> None:
    order_id = _convert(client, session_factory)
    with session_factory() as db:
        order = db.scalar(select(SalesOrder).where(SalesOrder.id == order_id))
        assert order is not None
        order.amount = Decimal("500.00")
        db.commit()

    for status in ("confirmed", "production", "ready", "shipped"):
        response = client.patch(f"/orders/{order_id}/status", json={"status": status})
        assert response.status_code == 200, response.text

    blocked = client.patch(f"/orders/{order_id}/status", json={"status": "completed"})
    assert blocked.status_code == 409
    assert "оплата не полная" in blocked.json()["detail"].lower()

    paid = client.patch(
        f"/orders/{order_id}/payment",
        json={"payment_status": "paid"},
    )
    assert paid.status_code == 200

    done = client.patch(f"/orders/{order_id}/status", json={"status": "completed"})
    assert done.status_code == 200
    assert done.json()["status"] == "completed"


def test_material_reserve_patch(
    client: TestClient, session_factory: sessionmaker[Session]
) -> None:
    order_id = _convert(client, session_factory)
    response = client.patch(
        f"/orders/{order_id}/material-reserve",
        json={"material_reserve_status": "reserved"},
    )
    assert response.status_code == 200
    assert response.json()["material_reserve_status"] == "reserved"
