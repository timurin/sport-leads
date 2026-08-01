"""Stage 4.4.6 — variant price / barcode / external_code."""

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


@pytest.fixture()
def session_factory() -> sessionmaker[Session]:
    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, expire_on_commit=False)
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


def _seed_variant(client: TestClient) -> tuple[dict, dict]:
    category = client.post(
        "/nomenclatures/categories",
        json={
            "name": "Price form",
            "code": "price-form-446",
            "nomenclature_type": "PRODUCT",
        },
    ).json()
    nomenclature = client.post(
        "/nomenclatures",
        json={
            "name": "Jersey",
            "category": "Price form",
            "category_id": category["id"],
            "base_price": "150.00",
        },
    ).json()
    definition = client.post(
        "/characteristics/definitions",
        json={
            "code": "price_color_446",
            "name": "Color",
            "kind": "COLOR",
            "is_variant_dimension": True,
        },
    ).json()
    option = client.post(
        f"/characteristics/definitions/{definition['id']}/options",
        json={"code": "blue", "label": "Синий", "hex_value": "#0000FF"},
    ).json()
    assert (
        client.post(
            f"/characteristics/categories/{category['id']}",
            json={"characteristic_id": definition["id"]},
        ).status_code
        == 201
    )
    assert (
        client.post(
            f"/characteristics/nomenclatures/{nomenclature['id']}",
            json={"characteristic_id": definition["id"]},
        ).status_code
        == 201
    )
    variant = client.post(
        f"/characteristics/nomenclatures/{nomenclature['id']}/variants",
        json={
            "article": "JERSEY-BLUE-446",
            "name": "Jersey / Blue",
            "option_ids": [option["id"]],
            "price": "199.50",
            "barcode": "4601234567890",
            "external_code": "1C-SKU-446",
        },
    )
    assert variant.status_code == 201, variant.text
    return nomenclature, variant.json()


def test_variant_create_and_patch_commercial_fields(client: TestClient) -> None:
    nomenclature, variant = _seed_variant(client)
    assert variant["price"] == "199.50"
    assert variant["barcode"] == "4601234567890"
    assert variant["external_code"] == "1C-SKU-446"

    listed = client.get(
        f"/characteristics/nomenclatures/{nomenclature['id']}/variants"
    )
    assert listed.status_code == 200
    assert listed.json()[0]["barcode"] == "4601234567890"

    patched = client.patch(
        f"/characteristics/variants/{variant['id']}",
        json={"price": None, "barcode": "4609999999999", "external_code": None},
    )
    assert patched.status_code == 200, patched.text
    body = patched.json()
    assert body["price"] is None
    assert body["barcode"] == "4609999999999"
    assert body["external_code"] is None


def test_variant_barcode_unique_and_negative_price_rejected(
    client: TestClient,
) -> None:
    _, first = _seed_variant(client)
    category = client.post(
        "/nomenclatures/categories",
        json={
            "name": "Other form",
            "code": "other-form-446",
            "nomenclature_type": "PRODUCT",
        },
    ).json()
    nomenclature = client.post(
        "/nomenclatures",
        json={
            "name": "Other",
            "category": "Other form",
            "category_id": category["id"],
        },
    ).json()
    definition = client.post(
        "/characteristics/definitions",
        json={
            "code": "other_color_446",
            "name": "Other Color",
            "kind": "COLOR",
            "is_variant_dimension": True,
        },
    ).json()
    option = client.post(
        f"/characteristics/definitions/{definition['id']}/options",
        json={"code": "green", "label": "Зелёный", "hex_value": "#00FF00"},
    ).json()
    assert (
        client.post(
            f"/characteristics/categories/{category['id']}",
            json={"characteristic_id": definition["id"]},
        ).status_code
        == 201
    )
    assert (
        client.post(
            f"/characteristics/nomenclatures/{nomenclature['id']}",
            json={"characteristic_id": definition["id"]},
        ).status_code
        == 201
    )

    duplicate = client.post(
        f"/characteristics/nomenclatures/{nomenclature['id']}/variants",
        json={
            "article": "OTHER-GREEN-446",
            "name": "Other / Green",
            "option_ids": [option["id"]],
            "barcode": first["barcode"],
        },
    )
    assert duplicate.status_code == 409

    negative = client.patch(
        f"/characteristics/variants/{first['id']}",
        json={"price": "-1.00"},
    )
    assert negative.status_code == 422
