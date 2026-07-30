"""Stage 4.5.2 — nomenclature export + import template (same columns)."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.database.base import Base
from app.database.session import get_db
from app.main import app
from app.services.file_io import parse_tabular_bytes
from app.services.nomenclature_file_columns import (
    NOMENCLATURE_FILE_HEADERS,
    NOMENCLATURE_TEMPLATE_CHAR_CODES,
    build_file_headers,
)


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


def test_import_template_columns_match_contract(client: TestClient) -> None:
    response = client.get("/nomenclatures/import-template?format=csv")
    assert response.status_code == 200, response.text
    assert "attachment" in response.headers.get("content-disposition", "")
    table = parse_tabular_bytes(response.content, filename="t.csv")
    assert table.headers == build_file_headers(NOMENCLATURE_TEMPLATE_CHAR_CODES)
    assert "product_type_name" in table.headers
    assert "product_model_articles" in table.headers
    assert "photo_paths" in table.headers
    assert "char:color" in table.headers
    assert len(table.rows) == 2
    assert table.rows[0]["name"]


def test_export_includes_created_row_and_filters(client: TestClient) -> None:
    created = client.post(
        "/nomenclatures",
        json={
            "name": "Export Shirt",
            "category": "Forms",
            "nomenclature_type": "PRODUCT",
            "unit": "pcs",
            "base_price": "99.00",
            "currency": "RUB",
        },
    )
    assert created.status_code == 201, created.text

    inactive = client.post(
        "/nomenclatures",
        json={
            "name": "Hidden Inactive",
            "category": "Forms",
            "nomenclature_type": "MATERIAL",
            "unit": "m",
            "base_price": "1.00",
            "currency": "RUB",
            "is_active": False,
        },
    )
    assert inactive.status_code == 201, inactive.text

    active_only = client.get("/nomenclatures/export?format=csv&is_active=true")
    assert active_only.status_code == 200, active_only.text
    table = parse_tabular_bytes(active_only.content, filename="e.csv")
    for header in NOMENCLATURE_FILE_HEADERS:
        assert header in table.headers
    names = [row["name"] for row in table.rows]
    assert "Export Shirt" in names
    assert "Hidden Inactive" not in names

    typed = client.get(
        "/nomenclatures/export?format=csv&nomenclature_type=PRODUCT&search=Export"
    )
    assert typed.status_code == 200
    typed_table = parse_tabular_bytes(typed.content, filename="e2.csv")
    assert [row["name"] for row in typed_table.rows] == ["Export Shirt"]


def test_template_round_trip_dry_run_import(client: TestClient) -> None:
    template = client.get("/nomenclatures/import-template?format=csv")
    assert template.status_code == 200
    dry = client.post(
        "/nomenclatures/import?dry_run=true",
        files={"file": ("template.csv", template.content, "text/csv")},
    )
    assert dry.status_code == 200, dry.text
    body = dry.json()
    assert body["can_commit"] is True
    assert body["total_rows"] == 2


def test_export_import_extended_fields(client: TestClient, tmp_path, session_factory) -> None:
    from app.models.size_grid import SizeGrid, SizeGridSizeType

    product_type = client.post(
        "/product-types",
        json={"name": "Tshirt Export", "is_active": True, "sort_order": 0},
    )
    assert product_type.status_code == 201, product_type.text
    product_type_id = product_type.json()["id"]

    with session_factory() as db:
        grid = SizeGrid(name="Men Export Grid", size_type=SizeGridSizeType.MEN)
        db.add(grid)
        db.commit()
        db.refresh(grid)
        grid_id = grid.id

    model = client.post(
        "/product-models",
        json={
            "article": "EXP-MODEL-1",
            "name": "Export Model",
            "size_type": "men",
            "product_type_id": product_type_id,
            "size_grid_id": grid_id,
        },
    )
    assert model.status_code == 201, model.text
    model_id = model.json()["id"]
    if model.json().get("size_grid_id") is None:
        patched = client.patch(
            f"/product-models/{model_id}",
            json={"size_grid_id": grid_id},
        )
        assert patched.status_code == 200, patched.text
    activated = client.post(f"/product-models/{model_id}/activate")
    assert activated.status_code == 200, activated.text

    definition = client.post(
        "/characteristics/definitions",
        json={
            "code": "brand_export",
            "name": "Brand Export",
            "kind": "STRING",
            "is_variant_dimension": False,
        },
    )
    assert definition.status_code == 201, definition.text
    definition_id = definition.json()["id"]

    created = client.post(
        "/nomenclatures",
        json={
            "name": "Extended Export Item",
            "category": "Forms",
            "nomenclature_type": "PRODUCT",
            "product_type_id": product_type_id,
            "unit": "pcs",
            "base_price": "50.00",
            "currency": "RUB",
        },
    )
    assert created.status_code == 201, created.text
    item_id = created.json()["id"]

    linked = client.post(
        f"/nomenclatures/{item_id}/available-models",
        json={"product_model_id": model_id},
    )
    assert linked.status_code == 201, linked.text

    assigned = client.post(
        f"/characteristics/nomenclatures/{item_id}/values",
        json={"characteristic_id": definition_id},
    )
    assert assigned.status_code in (200, 201), assigned.text
    saved = client.put(
        f"/characteristics/nomenclatures/{item_id}/values",
        json=[{"characteristic_id": definition_id, "value": "Nike"}],
    )
    assert saved.status_code == 200, saved.text

    exported = client.get("/nomenclatures/export?format=csv&search=Extended%20Export")
    assert exported.status_code == 200, exported.text
    table = parse_tabular_bytes(exported.content, filename="ext.csv")
    assert "product_type_name" in table.headers
    assert "photo_paths" in table.headers
    assert "char:brand_export" in table.headers
    row = next(r for r in table.rows if r["name"] == "Extended Export Item")
    assert row["product_type_name"] == "Tshirt Export"
    assert row["char:brand_export"] == "Nike"
    assert "EXP-MODEL-1" in (row.get("product_model_articles") or "")

    photo = tmp_path / "sample.png"
    photo.write_bytes(
        bytes.fromhex(
            "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4"
            "890000000a49444154789c63000100000500010d0a2db40000000049454e44ae426082"
        )
    )

    csv = (
        "name,nomenclature_type,product_type_name,unit,base_price,currency,is_active,"
        "product_model_articles,photo_paths,char:brand_export\n"
        f"Extended Import Copy,PRODUCT,Tshirt Export,pcs,50.00,RUB,true,"
        f"EXP-MODEL-1,{photo.as_posix()},Nike\n"
    )
    commit = client.post(
        "/nomenclatures/import?dry_run=false",
        files={"file": ("copy.csv", csv.encode("utf-8"), "text/csv")},
    )
    assert commit.status_code == 200, commit.text
    body = commit.json()
    assert body["can_commit"] is True, body.get("errors")
    assert body["created_count"] == 1

    listed = client.get("/nomenclatures?search=Extended%20Import%20Copy")
    assert listed.status_code == 200
    copy = next(r for r in listed.json() if r["name"] == "Extended Import Copy")
    assert copy["product_type_name"] == "Tshirt Export"

    values = client.get(f"/characteristics/nomenclatures/{copy['id']}/values")
    assert values.status_code == 200
    brand = next(v for v in values.json() if v["code"] == "brand_export")
    assert brand["value"] == "Nike"

    media = client.get(f"/nomenclatures/{copy['id']}/media")
    assert media.status_code == 200
    assert len(media.json()) >= 1

    models = client.get(f"/nomenclatures/{copy['id']}/available-models")
    assert models.status_code == 200
    articles = [
        row.get("article") or row.get("product_model_article") for row in models.json()
    ]
    assert "EXP-MODEL-1" in articles
