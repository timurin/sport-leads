"""Copy nomenclature master card (`POST /nomenclatures/{id}/copy`)."""

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


def test_copy_nomenclature_duplicates_card_fields(client: TestClient) -> None:
    created = client.post(
        "/nomenclatures",
        json={
            "name": "Футболка базовая",
            "short_name": "Футб.",
            "description": "Описание",
            "category": "Без категории",
            "nomenclature_type": "PRODUCT",
            "unit": "шт",
            "base_price": "1500.00",
            "currency": "RUB",
        },
    )
    assert created.status_code == 201, created.text
    source = created.json()

    copied = client.post(f"/nomenclatures/{source['id']}/copy")
    assert copied.status_code == 201, copied.text
    body = copied.json()
    assert body["id"] != source["id"]
    assert body["name"] == "Футболка базовая (копия)"
    assert body["short_name"] == source["short_name"]
    assert body["description"] == source["description"]
    assert body["nomenclature_type"] == source["nomenclature_type"]
    assert body["base_price"] == source["base_price"]
    assert body["currency"] == source["currency"]
    assert body["is_active"] is True

    second = client.post(f"/nomenclatures/{source['id']}/copy")
    assert second.status_code == 201, second.text
    assert second.json()["name"] == "Футболка базовая (копия) 2"


def test_copy_nomenclature_missing_returns_404(client: TestClient) -> None:
    response = client.post("/nomenclatures/999999/copy")
    assert response.status_code == 404
