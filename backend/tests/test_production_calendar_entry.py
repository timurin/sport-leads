from datetime import date
from decimal import Decimal

import pytest
from sqlalchemy import create_engine, event, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient

from app.api.deps_auth import get_current_platform_user
from app.database.base import Base
from app.database.session import get_db
from app.main import app
from app.models.auth import PlatformUser
from app.models.calendar_assignment import CalendarAssignment
from app.models.production_stage import ProductionStage
from app.models.rbac import Permission, Role
from app.models.technical_card import TechnicalCard, TechnicalCardOrderGroup
from app.services.rbac import PERM_TECHNICAL_CARDS_CREATE

URL = "/production-calendar/assignments"


@pytest.fixture
def entry_client():
    engine = create_engine("sqlite+pysqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)

    @event.listens_for(engine, "connect")
    def foreign_keys(connection, _):
        connection.execute("PRAGMA foreign_keys=ON")

    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, expire_on_commit=False)
    with factory() as db:
        db.add_all([
            ProductionStage(id=1, name="Подготовка к запуску", code="launch_preparation", sort_order=0, is_active=True),
            ProductionStage(id=2, name="Печать", code="print", sort_order=20, is_active=True),
            ProductionStage(id=3, name="Пошив", code="sewing", sort_order=40, is_active=True),
            ProductionStage(id=4, name="Архив", code="archive", sort_order=90, is_active=False),
            TechnicalCardOrderGroup(id=1, order_number="ENTRY-1", tech_cards_planned_count=4, desired_date=date(2026, 10, 11)),
        ])
        db.flush()
        db.add_all([TechnicalCard(id=i, order_group_id=1, number=f"ENTRY-TC-{i}", card_seq=i, quantity=Decimal("12")) for i in range(1, 5)])
        db.commit()
    user = PlatformUser(id=1, login="manager", roles=[Role(code="planner", name="Planner", permissions=[Permission(code=PERM_TECHNICAL_CARDS_CREATE)])])
    original = dict(app.dependency_overrides)

    def override_db():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_current_platform_user] = lambda: user
    try:
        with TestClient(app) as client:
            yield client, factory, user
    finally:
        app.dependency_overrides.clear()
        app.dependency_overrides.update(original)
        engine.dispose()


def create(client, card_id=1, day="2026-10-05", note=None):
    response = client.post(URL, json={"technical_card_id": card_id, "planned_date": day, "note": note})
    assert response.status_code == 200, response.text
    return response.json()


def test_minimal_create_appends_stable_order_and_preserves_quantity(entry_client):
    client, factory, _ = entry_client
    first = create(client)
    second = create(client, 2)
    assert first["production_stage_id"] == second["production_stage_id"] == 1
    assert first["production_stage_name"] == "Подготовка к запуску"
    assert (first["position"], second["position"]) == (0, 1)
    assert first["quantity"] == "12.000" and first["technical_card_id"] == 1
    board = client.get("/production-calendar/board?from=2026-10-05&to=2026-10-11").json()
    assert board["stages"][0]["code"] == "launch_preparation"
    assert [row["id"] for row in board["assignments"]] == [first["id"], second["id"]]
    with factory() as db:
        assert db.get(TechnicalCard, 1).quantity == Decimal("12")
        assert db.get(CalendarAssignment, first["id"]).position == 0


def test_tail_is_per_date_and_stage_and_does_not_resequence_existing_rows(entry_client):
    client, factory, _ = entry_client
    with factory() as db:
        db.add_all([
            CalendarAssignment(technical_card_id=1, production_stage_id=1, planned_date=date(2026, 10, 5), position=17, note="Keep"),
            CalendarAssignment(technical_card_id=2, production_stage_id=2, planned_date=date(2026, 10, 5), position=999),
            CalendarAssignment(technical_card_id=3, production_stage_id=1, planned_date=date(2026, 10, 6), position=100),
        ])
        db.commit()
    appended = create(client, 4)
    assert appended["position"] == 18
    # An existing printing assignment does not block a separate entry-stage pair.
    other_day = create(client, 2, "2026-10-07")
    assert other_day["position"] == 0
    with factory() as db:
        preserved = db.scalar(select(CalendarAssignment).where(CalendarAssignment.technical_card_id == 1))
        assert preserved.position == 17 and preserved.note == "Keep"


def test_retry_is_idempotent_and_conflict_does_not_reset_manual_position(entry_client):
    client, _, _ = entry_client
    row = create(client, note="Материал")
    moved = client.put(f"{URL}/{row['id']}", json={"production_stage_id": 1, "planned_date": "2026-10-05", "position": 8, "note": "Материал"})
    assert moved.status_code == 200
    repeated = create(client, note="Материал")
    assert repeated["id"] == row["id"] and repeated["position"] == 8
    assert client.post(URL, json={"technical_card_id": 1, "planned_date": "2026-10-06", "note": "Материал"}).status_code == 409
    assert client.post(URL, json={"technical_card_id": 1, "planned_date": "2026-10-05", "note": "Other"}).status_code == 409
    assert create(client, 2)["position"] == 9


@pytest.mark.parametrize("extra", [
    {"production_stage_id": 2}, {"production_stage_id": 3}, {"production_stage_id": None},
    {"stage": "print"}, {"section": "cutting"}, {"position": 0}, {"position": 99}, {"quantity": 12},
])
def test_user_cannot_select_stage_or_position_on_create(entry_client, extra):
    client, factory, _ = entry_client
    response = client.post(URL, json={"technical_card_id": 1, "planned_date": "2026-10-05", **extra})
    assert response.status_code == 422
    with factory() as db:
        assert db.scalar(select(CalendarAssignment.id)) is None


def test_dispatcher_edit_delete_and_existing_assignment_compatibility(entry_client):
    client, factory, _ = entry_client
    with factory() as db:
        legacy = CalendarAssignment(technical_card_id=1, production_stage_id=2, planned_date=date(2026, 10, 4), position=31, note="Legacy")
        db.add(legacy); db.commit(); legacy_id = legacy.id
    row = create(client, 2)
    changed = client.put(f"{URL}/{row['id']}", json={"production_stage_id": 3, "planned_date": "2026-10-12", "position": 4, "note": "Диспетчер"})
    assert changed.status_code == 200 and changed.json()["production_stage_id"] == 3
    reloaded = client.get("/production-calendar/board?from=2026-10-12&to=2026-10-18").json()["assignments"][0]
    assert reloaded["id"] == row["id"] and reloaded["note"] == "Диспетчер" and reloaded["position"] == 4
    with factory() as db:
        old = db.get(CalendarAssignment, legacy_id)
        assert old.production_stage_id == 2 and old.position == 31 and old.note == "Legacy"
    assert client.delete(f"{URL}/{row['id']}").status_code == 204


def test_missing_or_inactive_entry_stage_never_falls_back(entry_client):
    client, factory, _ = entry_client
    with factory() as db:
        db.get(ProductionStage, 1).is_active = False
        db.commit()
    assert client.post(URL, json={"technical_card_id": 1, "planned_date": "2026-10-05"}).status_code == 503
    with factory() as db:
        db.delete(db.get(ProductionStage, 1)); db.commit()
    assert client.post(URL, json={"technical_card_id": 1, "planned_date": "2026-10-05"}).status_code == 503
    with factory() as db:
        assert db.scalar(select(CalendarAssignment.id)) is None


def test_permissions_milestone_registration_and_read_shape(entry_client):
    client, _, user = entry_client
    assert client.post(URL, json={"technical_card_id": 1, "planned_date": "2026-10-05"}).json()["position"] == 0
    resources = client.get("/production-calendar/capacity/settings").json()["resources"]
    procurement = next(resource for resource in resources if resource["key"] == "procurement")
    assert procurement["production_stage_id"] == 1 and procurement["stage_code"] == "launch_preparation"
    assert procurement["kind"] == procurement["unit"] == "milestone" and procurement["base_capacity"] is None
    assert procurement["editable_fields"] == []
    load = client.post("/production-calendar/capacity/load-state", json={"resource_key": "procurement", "date": "2026-10-05", "demands": [{"unit": "milestone"}]}).json()
    assert load["reason"] == "milestone" and load["load_percent"] is None
    user.roles = []
    assert client.post(URL, json={"technical_card_id": 2, "planned_date": "2026-10-05"}).status_code == 403
    app.dependency_overrides.pop(get_current_platform_user)
    assert client.post(URL, json={"technical_card_id": 2, "planned_date": "2026-10-05"}).status_code == 401


def test_integer_position_limit_is_explicit_conflict_not_database_overflow(entry_client):
    client, factory, _ = entry_client
    with factory() as db:
        db.add(CalendarAssignment(technical_card_id=1, production_stage_id=1, planned_date=date(2026, 10, 5), position=2147483647))
        db.commit()
    assert client.post(URL, json={"technical_card_id": 2, "planned_date": "2026-10-05"}).status_code == 409


def test_openapi_create_is_minimal_but_response_and_update_keep_stage_position():
    schemas = app.openapi()["components"]["schemas"]
    assert set(schemas["AssignmentCreate"]["properties"]) == {"technical_card_id", "planned_date", "note"}
    assert set(schemas["AssignmentCreate"]["required"]) == {"technical_card_id", "planned_date"}
    for name in ["AssignmentRead", "AssignmentUpdate"]:
        assert {"production_stage_id", "position"} <= set(schemas[name]["properties"])
