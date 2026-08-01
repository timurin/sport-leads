"""Stage 3.4.1 — design approval status gate before production."""

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
        lead = Lead(contact_name="Design lead", status=LeadStatus.NEW, responsible_id=1)
        db.add(lead)
        db.commit()
        lead_id = lead.id
    return client.post(
        f"/leads/{lead_id}/convert",
        json={"completed_by_id": 1},
    ).json()["order"]["id"]


def test_default_design_approval_not_required(
    client: TestClient, session_factory: sessionmaker[Session]
) -> None:
    order_id = _convert(client, session_factory)
    body = client.get(f"/orders/{order_id}").json()
    assert body["design_approval_status"] == "not_required"


def test_production_blocked_until_design_approved(
    client: TestClient, session_factory: sessionmaker[Session]
) -> None:
    order_id = _convert(client, session_factory)
    patched = client.patch(
        f"/orders/{order_id}/design-approval",
        json={"design_approval_status": "pending"},
    )
    assert patched.status_code == 200
    assert patched.json()["design_approval_status"] == "pending"

    assert (
        client.patch(f"/orders/{order_id}/status", json={"status": "confirmed"}).status_code
        == 200
    )
    blocked = client.patch(f"/orders/{order_id}/status", json={"status": "production"})
    assert blocked.status_code == 409
    assert "дизайн не согласован" in blocked.json()["detail"].lower()

    approved = client.patch(
        f"/orders/{order_id}/design-approval",
        json={"design_approval_status": "approved"},
    )
    assert approved.status_code == 200
    allowed = client.patch(f"/orders/{order_id}/status", json={"status": "production"})
    assert allowed.status_code == 200
    assert allowed.json()["status"] == "production"


def test_not_required_allows_production(
    client: TestClient, session_factory: sessionmaker[Session]
) -> None:
    order_id = _convert(client, session_factory)
    assert (
        client.patch(f"/orders/{order_id}/status", json={"status": "confirmed"}).status_code
        == 200
    )
    allowed = client.patch(f"/orders/{order_id}/status", json={"status": "production"})
    assert allowed.status_code == 200
