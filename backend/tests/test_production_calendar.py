from datetime import date
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.deps_auth import get_current_platform_user
from app.database.base import Base
from app.database.session import get_db
from app.main import app
from app.models.auth import PlatformUser
from app.models.rbac import Role, Permission
from app.models.production_stage import ProductionStage
from app.models.technical_card import TechnicalCard, TechnicalCardOrderGroup
from app.services.rbac import PERM_TECHNICAL_CARDS_CREATE


@pytest.fixture
def calendar_client():
    engine = create_engine("sqlite+pysqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    @event.listens_for(engine, "connect")
    def foreign_keys(connection, _):
        connection.execute("PRAGMA foreign_keys=ON")
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, expire_on_commit=False)
    with factory() as db:
        group = TechnicalCardOrderGroup(order_number="QUEUE-1", tech_cards_planned_count=2, desired_date=date(2026, 10, 11))
        db.add(group)
        db.flush()
        db.add_all([
            TechnicalCard(id=1, order_group_id=group.id, number="TC-1", card_seq=1, quantity=Decimal("12"), nomenclature_name="Форма"),
            TechnicalCard(id=2, order_group_id=group.id, number="TC-2", card_seq=2, quantity=Decimal("8"), nomenclature_name="Шорты"),
            ProductionStage(id=1, name="Пошив", code="sewing", sort_order=1, is_active=True),
            ProductionStage(id=2, name="Печать", code="print", sort_order=2, is_active=True),
            ProductionStage(id=3, name="Архив", code="archive", sort_order=3, is_active=False),
            ProductionStage(id=4, name="Подготовка к запуску", code="launch_preparation", sort_order=0, is_active=True),
        ])
        db.commit()
    user = PlatformUser(id=1, login="planner", display_name="Planner", roles=[
        Role(code="planner", name="Planner", permissions=[Permission(code=PERM_TECHNICAL_CARDS_CREATE)])
    ])
    def db_override():
        with factory() as db:
            yield db
    original = dict(app.dependency_overrides)
    app.dependency_overrides[get_db] = db_override
    app.dependency_overrides[get_current_platform_user] = lambda: user
    try:
        with TestClient(app) as client:
            yield client, engine, user, factory
    finally:
        app.dependency_overrides.clear()
        app.dependency_overrides.update(original)
        engine.dispose()


def payload(**overrides):
    return dict(technical_card_id=1, planned_date="2026-10-05", note=None) | overrides


def test_queue_crud_range_move_duplicate_and_source_preservation(calendar_client):
    client, _, _, factory = calendar_client
    created = client.post("/production-calendar/assignments", json=payload())
    assert created.status_code == 200, created.text
    row = created.json()
    assert row["order_number"] == "QUEUE-1" and row["quantity"] == "12.000"
    assert client.post("/production-calendar/assignments", json=payload()).json()["id"] == row["id"]
    assert client.post("/production-calendar/assignments", json=payload(planned_date="2026-10-06")).status_code == 409
    url = "/production-calendar/board?from=2026-10-05&to=2026-10-11"
    assert len(client.get(url).json()["assignments"]) == 1
    assert client.get(url + "&stage_id=2").json()["assignments"] == []
    assert client.get("/production-calendar/board?from=2026-10-06&to=2026-10-11").json()["assignments"] == []
    move = {"production_stage_id": 2, "planned_date": "2026-10-12", "position": 3, "note": "Позже"}
    assert client.put(f"/production-calendar/assignments/{row['id']}", json=move).status_code == 200
    assert client.get(url).json()["assignments"] == []
    later = client.get("/production-calendar/board?from=2026-10-12&to=2026-10-18").json()["assignments"]
    assert later[0]["note"] == "Позже"
    assert client.delete(f"/production-calendar/assignments/{row['id']}").status_code == 204
    assert client.delete(f"/production-calendar/assignments/{row['id']}").status_code == 404
    with factory() as db:
        card = db.get(TechnicalCard, 1)
        assert card.quantity == Decimal("12") and card.status == "draft"
    assert len(client.get("/production-calendar/sources?search=QUEUE").json()) == 2


@pytest.mark.parametrize("changes", [
    {"technical_card_id": 999}, {"production_stage_id": 999}, {"production_stage_id": 3},
    {"planned_date": "bad"}, {"planned_date": "2026-02-30"}, {"position": -1},
    {"technical_card_id": 0}, {"quantity": 0},
])
def test_queue_rejects_invalid_inputs(calendar_client, changes):
    client, _, _, _ = calendar_client
    assert client.post("/production-calendar/assignments", json=payload(**changes)).status_code == 422


def test_queue_auth_range_and_bounded_join(calendar_client):
    client, engine, user, _ = calendar_client
    assert client.get("/production-calendar/board?from=2026-10-11&to=2026-10-05").status_code == 422
    assert client.get("/production-calendar/board?from=2026-01-01&to=2028-01-01").status_code == 422
    for card_id in [1, 2]:
        assert client.post("/production-calendar/assignments", json=payload(technical_card_id=card_id)).status_code == 200
    statements = []
    def track(_, __, sql, ___, ____, _____):
        if sql.lstrip().upper().startswith("SELECT"):
            statements.append(sql)
    event.listen(engine, "before_cursor_execute", track)
    try:
        board = client.get("/production-calendar/board?from=2026-10-05&to=2026-10-11").json()
        assert len(board["assignments"]) == 2
        assert len(statements) == 2  # stage lookup + joined slim queue, independent of row count
    finally:
        event.remove(engine, "before_cursor_execute", track)
    user.roles = []
    assert client.post("/production-calendar/assignments", json=payload()).status_code == 403
    app.dependency_overrides.pop(get_current_platform_user)
    assert client.get("/production-calendar/board?from=2026-10-05&to=2026-10-11").status_code == 401



def test_queue_preserves_existing_draft_delete_and_stage_conflict(calendar_client):
    client, _, _, _ = calendar_client
    created = client.post("/production-calendar/assignments", json=payload())
    assert created.status_code == 200
    assert client.delete("/production-stages/4").status_code == 409
    response = client.delete("/technical-cards/1")
    assert response.status_code == 204, response.text
    board = client.get("/production-calendar/board?from=2026-10-05&to=2026-10-11").json()
    assert board["assignments"] == []
    assert client.get("/technical-cards/2").status_code == 200
