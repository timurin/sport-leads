from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import event

from tests.test_production_scheduler_pc_04_3a import scheduler, run
from app.api.deps_auth import get_current_platform_user
from app.database.session import get_db
from app.main import app
from app.models.product_model import ProductModel
from app.models.production_capacity import CapacityResource
from app.models.technical_card import TechnicalCard, TechnicalCardUnitLine
from app.services.technical_card_readiness import read_readiness, STEPS
from app.services.technical_card_stages import start_technical_card
from app.services.technical_cards import TechnicalCardConflictError


def prepare(factory, *, personalized=4):
    with factory() as db:
        db.add(ProductModel(id=1, article="201.1", name="Test model", size_type="men", status="active"))
        card = db.get(TechnicalCard, 1)
        card.product_model_id = 1
        card.quantity = Decimal(4)
        for index in range(1, personalized + 1):
            db.add(TechnicalCardUnitLine(technical_card_id=1, unit_index=index))
        db.commit()


def step(result, code):
    return next(row for row in result.steps if row.code == code)


def test_new_card_has_fixed_steps_and_model_route_plan_blockers(scheduler):
    factory, _ = scheduler
    with factory() as db:
        card = db.get(TechnicalCard, 1)
        card.routing_template_id = None
        card.stage_results.clear()
        db.commit()
        result = read_readiness(db, 1)
        assert [row.code for row in result.steps] == [code for code, _ in STEPS]
        assert result.progress_total == 7 and not result.can_launch
        assert step(result, "model").blocking and step(result, "route").blocking
        assert step(result, "planning").blocking
        assert step(result, "route").fix_url == "/production/tech-cards/1"


def test_personalization_is_nonblocking_warning_and_never_replaces_quantity(scheduler):
    factory, _ = scheduler
    prepare(factory, personalized=1)
    assert run(factory).persisted
    with factory() as db:
        result = read_readiness(db, 1)
        row = step(result, "personalization")
        assert row.status == "warning" and not row.blocking
        assert row.summary == "Персонализация заполнена на 1 из 4 изделий."
        assert result.can_launch and result.overall_status == "warning"
        assert db.get(TechnicalCard, 1).quantity == 4


def test_saved_plan_ready_launch_waiting_and_zero_read_writes(scheduler):
    factory, engine = scheduler
    prepare(factory)
    assert run(factory).persisted
    writes = []
    def observe(connection, cursor, sql, *args):
        if sql.lstrip().upper().startswith(("INSERT", "UPDATE", "DELETE")):
            writes.append(sql)
    event.listen(engine, "before_cursor_execute", observe)
    try:
        with factory() as db:
            result = read_readiness(db, 1)
            assert result.can_launch and result.overall_status == "ready"
            assert step(result, "planning").status == "completed"
            assert result.progress_completed == 7
            card = start_technical_card(db, 1)
            assert card.status == "draft"
            assert all(row.status == "pending" and row.started_at is None for row in card.stage_results)
            assert read_readiness(db, 1).can_launch
        assert not writes
    finally:
        event.remove(engine, "before_cursor_execute", observe)


@pytest.mark.parametrize("change", ["model", "stale", "norm", "terminal"])
def test_blockers_agree_with_actual_launch_guard(scheduler, change):
    factory, _ = scheduler
    prepare(factory)
    assert run(factory).persisted
    with factory() as db:
        card = db.get(TechnicalCard, 1)
        if change == "model":
            card.product_model_id = None
        elif change == "stale":
            card.quantity = Decimal(5)
        elif change == "norm":
            resource = db.get(CapacityResource, "items")
            resource.resource_type = "labor"
            resource.calculation_mode, resource.capacity_unit = "explicit_hours", "labor_hour"
        else:
            card.stage_results[0].status = "completed"
            card.status = "completed"
            card.current_stage_order = None
            card.current_stage_label = None
            from app.services.technical_card_fulfillment import sync_ready
            sync_ready(db, card)
        db.commit()
        result = read_readiness(db, 1)
        assert not result.can_launch
        expected = {"model": "model", "stale": "planning", "norm": "norms", "terminal": "launch"}[change]
        assert step(result, expected).blocking is (change != "terminal")
        if change == "terminal":
            assert result.lifecycle_status == "completed"
            assert result.overall_status == "completed"
            assert result.progress_completed == 7
            assert step(result, "launch").fix_action is None
        with pytest.raises(TechnicalCardConflictError):
            start_technical_card(db, 1)


def test_endpoint_auth_not_found_and_contract(scheduler):
    factory, _ = scheduler
    prepare(factory)
    def database():
        with factory() as db:
            yield db
    app.dependency_overrides[get_db] = database
    try:
        with TestClient(app) as client:
            assert client.get("/technical-cards/1/readiness").status_code == 401
            app.dependency_overrides[get_current_platform_user] = lambda: object()
            response = client.get("/technical-cards/1/readiness")
            assert response.status_code == 200
            assert len(response.json()["steps"]) == 7
            assert not response.json()["can_launch"]
            assert client.get("/technical-cards/999/readiness").status_code == 404
            assert run(factory).persisted
            assert client.get("/technical-cards/1/readiness").json()["can_launch"]
            launched = client.post("/technical-cards/1/start")
            assert launched.status_code == 200, launched.text
            assert all(row["started_at"] is None for row in launched.json()["stage_results"])
    finally:
        app.dependency_overrides.pop(get_db, None)
        app.dependency_overrides.pop(get_current_platform_user, None)


def test_unverified_route_and_malformed_selection_are_friendly_blockers(scheduler):
    factory, _ = scheduler
    prepare(factory)
    run(factory)
    with factory() as db:
        card = db.get(TechnicalCard, 1)
        card.route_variant_groups = [{"secret": "never expose this payload"}]
        db.commit()
        result = read_readiness(db, 1)
        assert not result.can_launch and step(result, "route").blocking
        assert "never expose" not in result.model_dump_json()
        with pytest.raises(TechnicalCardConflictError):
            start_technical_card(db, 1)


def test_locked_valid_saved_plan_is_not_a_launch_blocker(scheduler):
    factory, _ = scheduler
    prepare(factory)
    run(factory)
    with factory() as db:
        db.get(TechnicalCard, 1).plan_locked = True
        db.commit()
        result = read_readiness(db, 1)
        assert result.can_launch
        start_technical_card(db, 1)
