"""Stage 3.3.2 — line VAT mode (inclusive/exclusive) + persisted vat_amount."""

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
        db.add_all(
            [
                VatRate(
                    name="0%",
                    rate_percent=Decimal("0.00"),
                    is_active=True,
                    sort_order=10,
                ),
                VatRate(
                    name="5%",
                    rate_percent=Decimal("5.00"),
                    is_active=True,
                    sort_order=20,
                ),
                VatRate(
                    name="22%",
                    rate_percent=Decimal("22.00"),
                    is_active=True,
                    sort_order=30,
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


def _rate_ids(session_factory: sessionmaker[Session]) -> dict[str, int]:
    with session_factory() as db:
        rows = db.scalars(select(VatRate)).all()
        return {row.name: row.id for row in rows}


def _convert(client: TestClient, session_factory: sessionmaker[Session]) -> int:
    with session_factory() as db:
        lead = Lead(contact_name="VAT lead", status=LeadStatus.NEW, responsible_id=1)
        db.add(lead)
        db.commit()
        lead_id = lead.id
    return client.post(
        f"/leads/{lead_id}/convert",
        json={"completed_by_id": 1},
    ).json()["order"]["id"]


def test_inclusive_vat_in_sum_persists_line_and_order(
    client: TestClient, session_factory: sessionmaker[Session]
) -> None:
    rates = _rate_ids(session_factory)
    order_id = _convert(client, session_factory)
    created = client.post(
        f"/orders/{order_id}/items",
        json={
            "snapshot_name": "Jersey incl",
            "unit": "шт",
            "quantity": "1",
            "unit_price": "12200.00",
            "vat_rate_id": rates["22%"],
            "price_includes_vat": True,
        },
    )
    assert created.status_code == 201, created.text
    item = created.json()
    assert item["price_includes_vat"] is True
    assert item["vat_amount"] == "2200.00"
    assert item["line_amount"] == "12200.00"
    assert item["line_total"] == "12200.00"

    order = client.get(f"/orders/{order_id}").json()
    assert order["items_subtotal"] == "12200.00"
    assert order["vat_amount"] == "2200.00"
    assert order["amount"] == "12200.00"
    assert order["amount_net"] == "10000.00"


def test_exclusive_vat_on_top_adds_to_totals(
    client: TestClient, session_factory: sessionmaker[Session]
) -> None:
    rates = _rate_ids(session_factory)
    order_id = _convert(client, session_factory)
    created = client.post(
        f"/orders/{order_id}/items",
        json={
            "snapshot_name": "Jersey excl",
            "unit": "шт",
            "quantity": "1",
            "unit_price": "10000.00",
            "vat_rate_id": rates["22%"],
            "price_includes_vat": False,
        },
    )
    assert created.status_code == 201, created.text
    item = created.json()
    assert item["price_includes_vat"] is False
    assert item["vat_amount"] == "2200.00"
    assert item["line_amount"] == "10000.00"
    assert item["line_total"] == "12200.00"

    order = client.get(f"/orders/{order_id}").json()
    assert order["items_subtotal"] == "12200.00"
    assert order["vat_amount"] == "2200.00"
    assert order["amount"] == "12200.00"
    assert order["amount_net"] == "10000.00"


def test_zero_rate_vat_is_zero_in_both_modes(
    client: TestClient, session_factory: sessionmaker[Session]
) -> None:
    rates = _rate_ids(session_factory)
    order_id = _convert(client, session_factory)
    for includes in (True, False):
        created = client.post(
            f"/orders/{order_id}/items",
            json={
                "snapshot_name": f"Zero {includes}",
                "unit": "шт",
                "quantity": "1",
                "unit_price": "1000.00",
                "vat_rate_id": rates["0%"],
                "price_includes_vat": includes,
            },
        )
        assert created.status_code == 201, created.text
        assert created.json()["vat_amount"] == "0.00"


def test_toggle_mode_and_order_discount_scales_vat(
    client: TestClient, session_factory: sessionmaker[Session]
) -> None:
    rates = _rate_ids(session_factory)
    order_id = _convert(client, session_factory)
    created = client.post(
        f"/orders/{order_id}/items",
        json={
            "snapshot_name": "Toggle",
            "unit": "шт",
            "quantity": "1",
            "unit_price": "10000.00",
            "vat_rate_id": rates["5%"],
            "price_includes_vat": False,
        },
    )
    assert created.status_code == 201, created.text
    item_id = created.json()["id"]
    assert created.json()["vat_amount"] == "500.00"

    switched = client.patch(
        f"/orders/{order_id}/items/{item_id}",
        json={"price_includes_vat": True, "unit_price": "10500.00"},
    )
    assert switched.status_code == 200, switched.text
    assert switched.json()["vat_amount"] == "500.00"
    assert switched.json()["line_total"] == "10500.00"

    discounted = client.patch(
        f"/orders/{order_id}/discount",
        json={"discount_percent": "10"},
    )
    assert discounted.status_code == 200, discounted.text
    body = discounted.json()
    assert body["items_subtotal"] == "10500.00"
    assert body["amount"] == "9450.00"
    # Scaled inclusive VAT: 10500 * 0.9 * 5/105
    assert body["vat_amount"] == "450.00"
    assert body["amount_net"] == "9000.00"
