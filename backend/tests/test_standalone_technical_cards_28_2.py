"""Stage 28.2 — standalone technical cards (contour B)."""

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
from app.models.technical_card import TechnicalCard, TechnicalCardOrderGroup


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


def _add_nomenclature(
    session_factory: sessionmaker[Session],
    *,
    name: str = "Футболка PRO",
    nomenclature_type: NomenclatureType = NomenclatureType.PRODUCT,
) -> int:
    with session_factory() as db:
        row = Nomenclature(
            name=name,
            category="Форма",
            nomenclature_type=nomenclature_type,
            unit="шт",
            base_price=Decimal("1500.00"),
        )
        db.add(row)
        db.commit()
        return row.id


def _create_payload(nomenclature_id: int, **overrides: object) -> dict[str, object]:
    body: dict[str, object] = {
        "nomenclature_id": nomenclature_id,
        "order_number": "1310",
        "tech_cards_planned_count": 5,
        "desired_date": "2026-09-15",
        "quantity": 3,
    }
    body.update(overrides)
    return body


def test_standalone_create_qty_unit_lines_and_display(
    client: TestClient, session_factory: sessionmaker[Session]
) -> None:
    nomenclature_id = _add_nomenclature(session_factory)
    created = client.post(
        "/technical-cards/standalone",
        json=_create_payload(nomenclature_id),
    )
    assert created.status_code == 201, created.text
    body = created.json()
    assert body["sales_order_id"] is None
    assert body["sales_order_item_id"] is None
    assert body["order_group_id"] is not None
    assert body["number"] == "1310-1"
    assert body["display_number"] == "1310-1/5"
    assert body["order_number"] == "1310"
    assert body["desired_date"] == "2026-09-15"
    assert body["tech_cards_planned_count"] == 5
    assert len(body["unit_lines"]) == 3
    assert [row["unit_index"] for row in body["unit_lines"]] == [1, 2, 3]


def test_standalone_reuses_group_and_increments_seq(
    client: TestClient, session_factory: sessionmaker[Session]
) -> None:
    nomenclature_id = _add_nomenclature(session_factory)
    first = client.post(
        "/technical-cards/standalone",
        json=_create_payload(nomenclature_id, tech_cards_planned_count=5),
    ).json()
    second = client.post(
        "/technical-cards/standalone",
        json=_create_payload(
            nomenclature_id,
            tech_cards_planned_count=9,
            desired_date="2026-12-01",
            quantity=1,
        ),
    )
    assert second.status_code == 201, second.text
    body = second.json()
    assert body["order_group_id"] == first["order_group_id"]
    assert body["number"] == "1310-2"
    assert body["display_number"] == "1310-2/5"
    assert body["desired_date"] == "2026-09-15"
    assert len(body["unit_lines"]) == 1

    with session_factory() as db:
        groups = list(db.scalars(select(TechnicalCardOrderGroup)).all())
        assert len(groups) == 1
        assert groups[0].tech_cards_planned_count == 5
        cards = list(db.scalars(select(TechnicalCard).order_by(TechnicalCard.card_seq)).all())
        assert [card.card_seq for card in cards] == [1, 2]


def test_standalone_soft_over_plan_create_allowed(
    client: TestClient, session_factory: sessionmaker[Session]
) -> None:
    nomenclature_id = _add_nomenclature(session_factory)
    first = client.post(
        "/technical-cards/standalone",
        json=_create_payload(nomenclature_id, tech_cards_planned_count=1, quantity=1),
    )
    second = client.post(
        "/technical-cards/standalone",
        json=_create_payload(nomenclature_id, tech_cards_planned_count=1, quantity=1),
    )
    assert first.status_code == 201
    assert second.status_code == 201, second.text
    assert second.json()["number"] == "1310-2"
    assert second.json()["display_number"] == "1310-2/1"


def test_standalone_unique_group_number_new_group(
    client: TestClient, session_factory: sessionmaker[Session]
) -> None:
    nomenclature_id = _add_nomenclature(session_factory)
    first = client.post(
        "/technical-cards/standalone",
        json=_create_payload(nomenclature_id, order_number="1310"),
    ).json()
    other = client.post(
        "/technical-cards/standalone",
        json=_create_payload(nomenclature_id, order_number="1311", quantity=1),
    )
    assert other.status_code == 201, other.text
    assert other.json()["order_group_id"] != first["order_group_id"]
    assert other.json()["number"] == "1311-1"
    with session_factory() as db:
        numbers = {
            row.order_number
            for row in db.scalars(select(TechnicalCardOrderGroup)).all()
        }
        assert numbers == {"1310", "1311"}


def test_standalone_list_and_patch_planned_live_display(
    client: TestClient, session_factory: sessionmaker[Session]
) -> None:
    nomenclature_id = _add_nomenclature(session_factory)
    created = client.post(
        "/technical-cards/standalone",
        json=_create_payload(nomenclature_id),
    ).json()
    listed = client.get("/technical-cards", params={"search": "1310"})
    assert listed.status_code == 200
    row = next(item for item in listed.json() if item["id"] == created["id"])
    assert row["sales_order_id"] is None
    assert row["order_number"] == "1310"
    assert row["display_number"] == "1310-1/5"
    assert row["desired_date"] == "2026-09-15"

    patched = client.patch(
        f"/technical-cards/order-groups/{created['order_group_id']}",
        json={"tech_cards_planned_count": 8},
    )
    assert patched.status_code == 200, patched.text
    assert patched.json()["tech_cards_planned_count"] == 8
    assert patched.json()["order_number"] == "1310"

    detail = client.get(f"/technical-cards/{created['id']}")
    assert detail.status_code == 200
    assert detail.json()["number"] == "1310-1"
    assert detail.json()["display_number"] == "1310-1/8"


def test_standalone_rejects_fractional_qty_and_non_product(
    client: TestClient, session_factory: sessionmaker[Session]
) -> None:
    product_id = _add_nomenclature(session_factory)
    material_id = _add_nomenclature(
        session_factory, name="Ткань", nomenclature_type=NomenclatureType.MATERIAL
    )
    fractional = client.post(
        "/technical-cards/standalone",
        json=_create_payload(product_id, quantity=1.5),
    )
    assert fractional.status_code == 422
    material = client.post(
        "/technical-cards/standalone",
        json=_create_payload(material_id, quantity=1),
    )
    assert material.status_code == 422
