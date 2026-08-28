"""Stage 28.1 — PATCH planned TC count on sales order + list display_number."""

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
        lead = Lead(contact_name="Planned TC lead", status=LeadStatus.NEW, responsible_id=1)
        db.add(lead)
        db.commit()
        return lead.id


def test_patch_tech_cards_planned_count_roundtrip(
    client: TestClient, session_factory: sessionmaker[Session]
) -> None:
    order_id = client.post(
        f"/leads/{add_lead(session_factory)}/convert",
        json={"completed_by_id": 1},
    ).json()["order"]["id"]

    got = client.get(f"/orders/{order_id}")
    assert got.status_code == 200
    assert got.json()["tech_cards_planned_count"] is None

    patched = client.patch(
        f"/orders/{order_id}/tech-cards-planned-count",
        json={"tech_cards_planned_count": 5},
    )
    assert patched.status_code == 200, patched.text
    assert patched.json()["tech_cards_planned_count"] == 5

    cleared = client.patch(
        f"/orders/{order_id}/tech-cards-planned-count",
        json={"tech_cards_planned_count": None},
    )
    assert cleared.status_code == 200
    assert cleared.json()["tech_cards_planned_count"] is None


def test_patch_tech_cards_planned_count_rejects_zero(
    client: TestClient, session_factory: sessionmaker[Session]
) -> None:
    order_id = client.post(
        f"/leads/{add_lead(session_factory)}/convert",
        json={"completed_by_id": 1},
    ).json()["order"]["id"]
    bad = client.patch(
        f"/orders/{order_id}/tech-cards-planned-count",
        json={"tech_cards_planned_count": 0},
    )
    assert bad.status_code == 422
