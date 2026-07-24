"""ADR-006 / 4.9.1 — category hierarchy is independent of nomenclature type."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.database.base import Base
from app.database.session import get_db
from app.main import app


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


def test_category_parent_and_nomenclature_ignore_type_mismatch(
    client: TestClient,
) -> None:
    root = client.post(
        "/nomenclatures/categories",
        json={
            "name": "Склад корень",
            "code": "wh-root-decouple",
            "nomenclature_type": "PRODUCT",
        },
    )
    assert root.status_code == 201, root.text
    root_id = root.json()["id"]

    child = client.post(
        "/nomenclatures/categories",
        json={
            "name": "Материалы в продукции",
            "code": "wh-child-material",
            "parent_id": root_id,
            "nomenclature_type": "MATERIAL",
        },
    )
    assert child.status_code == 201, child.text
    assert child.json()["parent_id"] == root_id

    material_in_product_tree = client.post(
        "/nomenclatures",
        json={
            "name": "Ткань в ветке продукции",
            "category": "Склад корень",
            "category_id": root_id,
            "nomenclature_type": "MATERIAL",
            "unit": "м",
            "base_price": "10.00",
            "currency": "RUB",
        },
    )
    assert material_in_product_tree.status_code == 201, material_in_product_tree.text
    assert material_in_product_tree.json()["category_id"] == root_id
    assert material_in_product_tree.json()["nomenclature_type"] == "MATERIAL"

    service_in_same = client.post(
        "/nomenclatures",
        json={
            "name": "Услуга в ветке продукции",
            "category": "Склад корень",
            "category_id": root_id,
            "nomenclature_type": "SERVICE",
            "unit": "шт",
            "base_price": "100.00",
            "currency": "RUB",
        },
    )
    assert service_in_same.status_code == 201, service_in_same.text


def test_category_cycle_still_rejected(client: TestClient) -> None:
    a = client.post(
        "/nomenclatures/categories",
        json={"name": "A", "code": "cycle-a", "nomenclature_type": "PRODUCT"},
    )
    assert a.status_code == 201
    a_id = a.json()["id"]
    b = client.post(
        "/nomenclatures/categories",
        json={
            "name": "B",
            "code": "cycle-b",
            "parent_id": a_id,
            "nomenclature_type": "GOODS",
        },
    )
    assert b.status_code == 201
    b_id = b.json()["id"]
    loop = client.patch(
        f"/nomenclatures/categories/{a_id}",
        json={"parent_id": b_id},
    )
    assert loop.status_code == 422


def test_category_self_parent_rejected(client: TestClient) -> None:
    created = client.post(
        "/nomenclatures/categories",
        json={"name": "Self", "code": "self-parent", "nomenclature_type": "PRODUCT"},
    )
    assert created.status_code == 201
    category_id = created.json()["id"]
    assert (
        client.patch(
            f"/nomenclatures/categories/{category_id}",
            json={"parent_id": category_id},
        ).status_code
        == 422
    )


def test_category_soft_deactivate_and_sort_order(client: TestClient) -> None:
    first = client.post(
        "/nomenclatures/categories",
        json={
            "name": "First",
            "code": "sort-first",
            "nomenclature_type": "PRODUCT",
            "sort_order": 0,
        },
    )
    second = client.post(
        "/nomenclatures/categories",
        json={
            "name": "Second",
            "code": "sort-second",
            "nomenclature_type": "PRODUCT",
            "sort_order": 1,
        },
    )
    assert first.status_code == 201
    assert second.status_code == 201
    first_id = first.json()["id"]
    second_id = second.json()["id"]

    swapped = client.patch(
        f"/nomenclatures/categories/{first_id}",
        json={"sort_order": 5},
    )
    assert swapped.status_code == 200
    assert swapped.json()["sort_order"] == 5

    deactivated = client.patch(
        f"/nomenclatures/categories/{second_id}",
        json={"is_active": False},
    )
    assert deactivated.status_code == 200
    assert deactivated.json()["is_active"] is False

    active_only = client.get("/nomenclatures/categories", params={"is_active": True})
    assert active_only.status_code == 200
    assert all(item["id"] != second_id for item in active_only.json())
