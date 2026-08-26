"""26.4.2 — generate variants from card values, not only assignment rows."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.database.base import Base
from app.database.session import get_db
from app.main import app
from app.models.nomenclature import NomenclatureHistoryEntry  # noqa: F401
from app.models.characteristics import NomenclatureVariant  # noqa: F401
from app.models.media import NomenclatureMedia  # noqa: F401


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


def test_generate_uses_variant_dimension_on_card_values(client: TestClient) -> None:
    """Card «+ характеристика» writes values, not nomenclature_characteristics."""
    category = client.post(
        "/nomenclatures/categories",
        json={
            "name": "Generate form",
            "code": "gen-form-2642",
            "nomenclature_type": "PRODUCT",
        },
    ).json()
    nomenclature = client.post(
        "/nomenclatures",
        json={
            "name": "Футболка",
            "category": "Generate form",
            "category_id": category["id"],
            "base_price": "100.00",
        },
    ).json()
    definition = client.post(
        "/characteristics/definitions",
        json={
            "code": "gen_color_2642",
            "name": "Цвет",
            "kind": "COLOR",
            "is_variant_dimension": True,
        },
    ).json()
    red = client.post(
        f"/characteristics/definitions/{definition['id']}/options",
        json={"code": "red", "label": "Красный", "hex_value": "#FF0000"},
    ).json()
    blue = client.post(
        f"/characteristics/definitions/{definition['id']}/options",
        json={"code": "blue", "label": "Синий", "hex_value": "#0000FF"},
    ).json()
    assigned = client.post(
        f"/characteristics/nomenclatures/{nomenclature['id']}/values",
        json={"characteristic_id": definition["id"]},
    )
    assert assigned.status_code == 201, assigned.text
    saved = client.put(
        f"/characteristics/nomenclatures/{nomenclature['id']}/values",
        json=[{"characteristic_id": definition["id"], "value": red["id"]}],
    )
    assert saved.status_code == 200, saved.text
    assert (
        client.get(f"/characteristics/nomenclatures/{nomenclature['id']}").json()
        == []
    )

    generated = client.post(
        f"/characteristics/nomenclatures/{nomenclature['id']}/variants/generate",
        json={"article_prefix": "N3"},
    )
    assert generated.status_code == 200, generated.text
    articles = sorted(row["article"] for row in generated.json())
    assert articles == ["N3-1", "N3-2"]
    option_ids = {tuple(sorted(row["option_ids"])) for row in generated.json()}
    assert option_ids == {(red["id"],), (blue["id"],)}


def test_generate_without_variant_dimensions_returns_russian_422(
    client: TestClient,
) -> None:
    category = client.post(
        "/nomenclatures/categories",
        json={
            "name": "Empty dims",
            "code": "empty-dims-2642",
            "nomenclature_type": "PRODUCT",
        },
    ).json()
    nomenclature = client.post(
        "/nomenclatures",
        json={
            "name": "Услуга",
            "category": "Empty dims",
            "category_id": category["id"],
        },
    ).json()
    failed = client.post(
        f"/characteristics/nomenclatures/{nomenclature['id']}/variants/generate",
        json={"article_prefix": "X"},
    )
    assert failed.status_code == 422
    assert "измерени" in failed.json()["detail"].lower()
