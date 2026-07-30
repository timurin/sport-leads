"""Stage 4.5.1.2 — nomenclature catalog import API (dry-run / commit)."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.database.base import Base
from app.database.session import get_db
from app.main import app
from app.models.nomenclature import Nomenclature


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


def _csv_file(content: str) -> dict:
    return {
        "file": ("items.csv", content.encode("utf-8"), "text/csv"),
    }


def test_import_dry_run_does_not_persist(client: TestClient, session_factory: sessionmaker[Session]) -> None:
    csv = "name,category,unit,base_price\nShirt A,Forms,pcs,100\nShirt B,Forms,pcs,200\n"
    response = client.post("/nomenclatures/import?dry_run=true", files=_csv_file(csv))
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["dry_run"] is True
    assert body["can_commit"] is True
    assert body["total_rows"] == 2
    assert body["valid_rows"] == 2
    assert body["created_count"] == 2
    assert body["updated_count"] == 0
    assert len(body["preview"]) == 2

    with session_factory() as db:
        count = db.scalar(select(func.count()).select_from(Nomenclature))
    assert int(count or 0) == 0


def test_import_commit_creates_rows(client: TestClient) -> None:
    csv = "name,category,type,unit,price\nMaterial X,Fabric,MATERIAL,m,12.5\n"
    dry = client.post("/nomenclatures/import?dry_run=true", files=_csv_file(csv))
    assert dry.status_code == 200
    assert dry.json()["can_commit"] is True

    commit = client.post("/nomenclatures/import?dry_run=false", files=_csv_file(csv))
    assert commit.status_code == 200, commit.text
    body = commit.json()
    assert body["dry_run"] is False
    assert body["created_count"] == 1
    assert body["created"][0]["name"] == "Material X"
    assert body["created"][0]["nomenclature_type"] == "MATERIAL"
    assert body["created"][0]["base_price"] == "12.50"

    listed = client.get("/nomenclatures")
    assert listed.status_code == 200
    assert any(row["name"] == "Material X" for row in listed.json())


def test_import_row_errors_block_commit(client: TestClient, session_factory: sessionmaker[Session]) -> None:
    csv = "name,category,base_price\nOk,Forms,10\n,Forms,bad\n"
    response = client.post("/nomenclatures/import?dry_run=false", files=_csv_file(csv))
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["can_commit"] is False
    assert body["created_count"] == 0
    assert body["error_rows"] >= 1
    codes = {err["code"] for err in body["errors"]}
    assert "required" in codes or "invalid_decimal" in codes

    with session_factory() as db:
        count = db.scalar(select(func.count()).select_from(Nomenclature))
    assert int(count or 0) == 0


def test_import_missing_name_column(client: TestClient) -> None:
    csv = "category,unit\nForms,pcs\n"
    response = client.post("/nomenclatures/import", files=_csv_file(csv))
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["can_commit"] is False
    assert body["errors"][0]["code"] == "missing_column"


def test_import_empty_file_returns_422(client: TestClient) -> None:
    response = client.post(
        "/nomenclatures/import",
        files={"file": ("empty.csv", b"", "text/csv")},
    )
    assert response.status_code == 422


def test_import_updates_existing_by_name_no_duplicate(client: TestClient) -> None:
    first = client.post(
        "/nomenclatures/import?dry_run=false",
        files=_csv_file("name,category,unit,base_price\nShirt A,Forms,pcs,100\n"),
    )
    assert first.status_code == 200, first.text
    assert first.json()["created_count"] == 1

    second = client.post(
        "/nomenclatures/import?dry_run=false",
        files=_csv_file("name,category,unit,base_price\nShirt A,Forms,pcs,250\nShirt B,Forms,pcs,10\n"),
    )
    assert second.status_code == 200, second.text
    body = second.json()
    assert body["created_count"] == 1
    assert body["updated_count"] == 1
    assert body["updated"][0]["name"] == "Shirt A"
    assert body["updated"][0]["base_price"] == "250.00"

    listed = client.get("/nomenclatures?limit=500").json()
    shirts = [row for row in listed if row["name"].startswith("Shirt")]
    assert len(shirts) == 2


def test_import_updates_name_by_id(client: TestClient) -> None:
    created = client.post(
        "/nomenclatures",
        json={
            "name": "Old Name",
            "category": "Forms",
            "nomenclature_type": "PRODUCT",
            "unit": "pcs",
            "base_price": "1.00",
            "currency": "RUB",
        },
    )
    assert created.status_code == 201
    item_id = created.json()["id"]

    response = client.post(
        "/nomenclatures/import?dry_run=false",
        files=_csv_file(
            f"id,name,category,unit,base_price\n{item_id},New Name,Forms,pcs,5\n"
        ),
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["created_count"] == 0
    assert body["updated_count"] == 1
    assert body["updated"][0]["name"] == "New Name"
