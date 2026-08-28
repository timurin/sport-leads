"""Stage 26.11 — copy technical card + delete draft-only."""

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
from app.models.nomenclature import Nomenclature, NomenclatureHistoryEntry, NomenclatureType  # noqa: F401
from app.models.sales import SalesUser
from app.models.technical_card import TechnicalCard, TechnicalCardStatus


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


def _add_nomenclature(session_factory: sessionmaker[Session]) -> int:
    with session_factory() as db:
        row = Nomenclature(
            name="Футболка PRO",
            category="Форма",
            nomenclature_type=NomenclatureType.PRODUCT,
            unit="шт",
            base_price=Decimal("1500.00"),
        )
        db.add(row)
        db.commit()
        return row.id


def test_copy_creates_standalone_draft(
    client: TestClient, session_factory: sessionmaker[Session]
) -> None:
    nomenclature_id = _add_nomenclature(session_factory)
    created = client.post(
        "/technical-cards/standalone",
        json={
            "nomenclature_id": nomenclature_id,
            "order_number": "1310",
            "tech_cards_planned_count": 2,
            "desired_date": "2026-09-15",
            "quantity": 2,
        },
    )
    assert created.status_code == 201, created.text
    source_id = created.json()["id"]
    copied = client.post(f"/technical-cards/{source_id}/copy")
    assert copied.status_code == 201, copied.text
    body = copied.json()
    assert body["id"] != source_id
    assert body["status"] == "draft"
    assert body["sales_order_id"] is None
    assert body["sales_order_item_id"] is None
    assert body["nomenclature_id"] == nomenclature_id
    assert len(body["unit_lines"]) == 2


def test_delete_draft_ok_in_progress_409(
    client: TestClient, session_factory: sessionmaker[Session]
) -> None:
    nomenclature_id = _add_nomenclature(session_factory)
    created = client.post(
        "/technical-cards/standalone",
        json={
            "nomenclature_id": nomenclature_id,
            "order_number": "1401",
            "tech_cards_planned_count": 1,
            "desired_date": "2026-09-15",
            "quantity": 1,
        },
    )
    assert created.status_code == 201, created.text
    card_id = created.json()["id"]
    deleted = client.delete(f"/technical-cards/{card_id}")
    assert deleted.status_code == 204, deleted.text
    assert client.get(f"/technical-cards/{card_id}").status_code == 404

    second = client.post(
        "/technical-cards/standalone",
        json={
            "nomenclature_id": nomenclature_id,
            "order_number": "1402",
            "tech_cards_planned_count": 1,
            "desired_date": "2026-09-15",
            "quantity": 1,
        },
    )
    assert second.status_code == 201, second.text
    other_id = second.json()["id"]
    with session_factory() as db:
        card = db.get(TechnicalCard, other_id)
        assert card is not None
        card.status = TechnicalCardStatus.IN_PROGRESS
        db.commit()
    blocked = client.delete(f"/technical-cards/{other_id}")
    assert blocked.status_code == 409
