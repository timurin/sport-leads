"""Stage 4.3.3.1 — nomenclature card history API."""

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
from app.services.nomenclature_history import HISTORY_LIMIT


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


def test_nomenclature_history_create_update_archive(client: TestClient) -> None:
    created = client.post(
        "/nomenclatures",
        json={"name": "History Card", "category": "test"},
    )
    assert created.status_code == 201, created.text
    item_id = created.json()["id"]

    history = client.get(f"/nomenclatures/{item_id}/history")
    assert history.status_code == 200, history.text
    actions = [row["action"] for row in history.json()]
    assert actions == ["Карточка создана"]

    patched = client.patch(
        f"/nomenclatures/{item_id}",
        json={"description": "updated"},
    )
    assert patched.status_code == 200, patched.text

    archived = client.patch(
        f"/nomenclatures/{item_id}",
        json={"is_active": False},
    )
    assert archived.status_code == 200, archived.text

    history = client.get(f"/nomenclatures/{item_id}/history")
    assert history.status_code == 200, history.text
    actions = [row["action"] for row in history.json()]
    assert actions[0] == "Карточка архивирована"
    assert any(a.startswith("Обновлены поля:") for a in actions)
    assert "Карточка создана" in actions


def test_nomenclature_history_fifo_cap(client: TestClient) -> None:
    created = client.post(
        "/nomenclatures",
        json={"name": "History Cap", "category": "test"},
    )
    assert created.status_code == 201, created.text
    item_id = created.json()["id"]

    for index in range(HISTORY_LIMIT + 3):
        response = client.patch(
            f"/nomenclatures/{item_id}",
            json={"description": f"v{index}"},
        )
        assert response.status_code == 200, response.text

    history = client.get(f"/nomenclatures/{item_id}/history")
    assert history.status_code == 200, history.text
    rows = history.json()
    assert len(rows) == HISTORY_LIMIT
    assert all(row["nomenclature_id"] == item_id for row in rows)


def test_nomenclature_history_not_found(client: TestClient) -> None:
    response = client.get("/nomenclatures/999999/history")
    assert response.status_code == 404
