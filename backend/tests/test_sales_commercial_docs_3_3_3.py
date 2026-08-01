"""Stage 3.3.3 — quotations and invoices from order snapshots."""

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
from app.models.sales import Lead, LeadRejectionReason, LeadStatus, SalesUser
from app.models.sales_commercial import SalesInvoice, SalesQuotation  # noqa: F401
from app.models.vat_rate import VatRate


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
        db.add(
            VatRate(
                name="22%",
                rate_percent=Decimal("22.00"),
                is_active=True,
                sort_order=30,
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


def _order_with_item(client: TestClient, session_factory: sessionmaker[Session]) -> tuple[int, int]:
    with session_factory() as db:
        lead = Lead(contact_name="Docs lead", status=LeadStatus.NEW, responsible_id=1)
        db.add(lead)
        db.commit()
        lead_id = lead.id
        rate_id = db.scalar(select(VatRate.id).where(VatRate.name == "22%"))
    order_id = client.post(
        f"/leads/{lead_id}/convert",
        json={"completed_by_id": 1},
    ).json()["order"]["id"]
    item = client.post(
        f"/orders/{order_id}/items",
        json={
            "snapshot_name": "Jersey",
            "unit": "шт",
            "quantity": "1",
            "unit_price": "12200.00",
            "vat_rate_id": rate_id,
            "price_includes_vat": True,
        },
    )
    assert item.status_code == 201, item.text
    return order_id, item.json()["id"]


def test_quotation_snapshots_vat_mode_and_currency(
    client: TestClient, session_factory: sessionmaker[Session]
) -> None:
    order_id, _ = _order_with_item(client, session_factory)
    created = client.post(f"/orders/{order_id}/quotations")
    assert created.status_code == 201, created.text
    body = created.json()
    assert body["number"].startswith(f"КП-{order_id}-")
    assert body["currency_code"] == "RUB"
    assert body["vat_amount"] == "2200.00"
    assert body["amount"] == "12200.00"
    assert body["amount_net"] == "10000.00"
    assert len(body["items"]) == 1
    line = body["items"][0]
    assert line["price_includes_vat"] is True
    assert line["vat_rate_percent"] == "22.00"
    assert line["vat_amount"] == "2200.00"
    assert line["line_total"] == "12200.00"

    listed = client.get(f"/orders/{order_id}/quotations")
    assert listed.status_code == 200
    assert len(listed.json()) == 1


def test_invoice_from_order_and_from_quotation(
    client: TestClient, session_factory: sessionmaker[Session]
) -> None:
    order_id, _ = _order_with_item(client, session_factory)
    quotation = client.post(f"/orders/{order_id}/quotations").json()

    from_order = client.post(f"/orders/{order_id}/invoices", json={})
    assert from_order.status_code == 201, from_order.text
    assert from_order.json()["quotation_id"] is None
    assert from_order.json()["items"][0]["price_includes_vat"] is True

    from_kp = client.post(
        f"/orders/{order_id}/invoices",
        json={"quotation_id": quotation["id"]},
    )
    assert from_kp.status_code == 201, from_kp.text
    body = from_kp.json()
    assert body["quotation_id"] == quotation["id"]
    assert body["number"].startswith(f"СЧ-{order_id}-")
    assert body["amount"] == quotation["amount"]
    assert body["items"][0]["vat_amount"] == "2200.00"

    listed = client.get(f"/orders/{order_id}/invoices")
    assert listed.status_code == 200
    assert len(listed.json()) == 2


def test_create_quotation_requires_items(
    client: TestClient, session_factory: sessionmaker[Session]
) -> None:
    with session_factory() as db:
        lead = Lead(contact_name="Empty", status=LeadStatus.NEW, responsible_id=1)
        db.add(lead)
        db.commit()
        lead_id = lead.id
    order_id = client.post(
        f"/leads/{lead_id}/convert",
        json={"completed_by_id": 1},
    ).json()["order"]["id"]
    empty = client.post(f"/orders/{order_id}/quotations")
    assert empty.status_code == 400
