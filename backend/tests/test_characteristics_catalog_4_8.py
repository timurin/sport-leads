"""Focused Stage 4.8 regression (ADR-015 residuals).

Covers:
- `/custom-fields` unmounted after cutover (`4.8.2` / `4.8.7`)
- characteristic definition DELETE usage guards (`4.8.3`)
- journal stub does not false-block unused deletes

Broader values/variant flows remain in `test_lead_conversion.py`.
Materials API removal remains in `test_materials_nomenclature_migration.py`.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.database.base import Base
from app.database.session import get_db
from app.main import app
from app.services.characteristic_operations_journal import (
    characteristic_has_journal_operations,
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


def test_custom_fields_api_is_unmounted() -> None:
    with TestClient(app) as client:
        assert client.get("/custom-fields").status_code == 404
        assert client.get("/custom-fields/definitions").status_code == 404
        assert (
            client.post(
                "/custom-fields/definitions",
                json={"name": "Legacy", "data_type": "STRING"},
            ).status_code
            == 404
        )
        assert client.delete("/custom-fields/definitions/1").status_code == 404


def test_journal_stub_reports_no_operations(session_factory: sessionmaker[Session]) -> None:
    with session_factory() as db:
        assert characteristic_has_journal_operations(db, characteristic_id=1) is False


def test_characteristic_definition_delete_guards(client: TestClient) -> None:
    created = client.post(
        "/characteristics/definitions",
        json={
            "name": "Orphan cleanup color",
            "kind": "STRING",
            "is_variant_dimension": False,
        },
    )
    assert created.status_code == 201
    definition_id = created.json()["id"]
    assert created.json().get("can_delete") is True

    unused = client.post(
        "/characteristics/definitions",
        json={
            "name": "Unused delete target",
            "kind": "STRING",
            "is_variant_dimension": False,
        },
    )
    assert unused.status_code == 201
    unused_id = unused.json()["id"]
    assert client.delete(f"/characteristics/definitions/{unused_id}").status_code == 204
    assert client.get(f"/characteristics/definitions/{unused_id}").status_code == 404

    nomenclature = client.post(
        "/nomenclatures",
        json={"name": "Uses characteristic", "category": "Uses characteristic"},
    ).json()
    assigned = client.post(
        f"/characteristics/nomenclatures/{nomenclature['id']}/values",
        json={"characteristic_id": definition_id},
    )
    assert assigned.status_code == 201

    blocked = client.delete(f"/characteristics/definitions/{definition_id}")
    assert blocked.status_code == 409
    detail = blocked.json()["detail"]
    assert "удалить" in detail.lower() or "использован" in detail.lower()

    listed = client.get(f"/characteristics/definitions/{definition_id}")
    assert listed.status_code == 200
    assert listed.json().get("can_delete") is False

    assert (
        client.delete(
            f"/characteristics/nomenclatures/{nomenclature['id']}/values/{definition_id}"
        ).status_code
        == 204
    )
    assert client.delete(f"/characteristics/definitions/{definition_id}").status_code == 204


def test_system_characteristic_definition_cannot_be_deleted(client: TestClient) -> None:
    definitions = client.get("/characteristics/definitions")
    assert definitions.status_code == 200
    system = next(
        (item for item in definitions.json() if item.get("is_system")),
        None,
    )
    assert system is not None
    assert system.get("can_delete") is False
    assert (
        client.delete(f"/characteristics/definitions/{system['id']}").status_code == 409
    )
