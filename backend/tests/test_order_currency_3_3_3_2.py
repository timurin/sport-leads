"""Stage 3.3.3.2 — SalesOrder.currency_code (ISO 4217 MVP)."""

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


def test_converted_order_defaults_currency_rub(
    client: TestClient, session_factory: sessionmaker[Session]
) -> None:
    with session_factory() as db:
        lead = Lead(contact_name="Currency lead", status=LeadStatus.NEW, responsible_id=1)
        db.add(lead)
        db.commit()
        lead_id = lead.id

    order = client.post(
        f"/leads/{lead_id}/convert",
        json={"completed_by_id": 1},
    ).json()["order"]
    assert order["currency_code"] == "RUB"

    fetched = client.get(f"/orders/{order['id']}")
    assert fetched.status_code == 200
    assert fetched.json()["currency_code"] == "RUB"
