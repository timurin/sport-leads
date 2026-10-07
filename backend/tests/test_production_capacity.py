from datetime import date
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event, func, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.deps_auth import get_current_platform_user
from app.database.base import Base
from app.database.session import get_db
from app.main import app
from app.models.auth import PlatformUser
from app.models.product_model import AssemblyOperationLine, AssemblyVariant, ProductModel
from app.models.production_capacity import ProductionCapacityException, ProductionCapacitySettings
from app.models.production_stage import ProductionStage
from app.models.rbac import Permission, Role
from app.models.sales import Client, SalesOrder, SalesOrderItem, SalesOrderItemAssemblyOperationSnapshot
from app.models.shop_routing import WorkCenter
from app.models.technical_card import TechnicalCard, TechnicalCardOperationLine, TechnicalCardOrderGroup
from app.services.rbac import PERM_TECHNICAL_CARDS_CREATE

BASE = "/production-calendar/capacity"


@pytest.fixture
def capacity_client():
    engine = create_engine("sqlite+pysqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)

    @event.listens_for(engine, "connect")
    def foreign_keys(connection, _):
        connection.execute("PRAGMA foreign_keys=ON")

    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, expire_on_commit=False)
    with factory() as db:
        db.add_all([ProductionStage(id=i, name=code, code=code, is_active=True) for i, code in enumerate(
            ["design", "print", "cutting", "sewing", "packaging"], start=1)])
        db.add(ProductModel(id=1, article="CAP-1", name="Форма", size_type="men"))
        db.add(TechnicalCardOrderGroup(id=1, order_number="CAP-ORDER", tech_cards_planned_count=1, desired_date=date(2026, 10, 11)))
        db.flush()
        db.add(AssemblyVariant(id=1, product_model_id=1, name="Сборка"))
        db.add_all([WorkCenter(id=i, name=f"Machine {i}", code=f"machine-{i}", production_stage_id=2 if i <= 5 else 3,
                               is_active=i != 8) for i in range(1, 9)])
        db.flush()
        db.add_all([
            AssemblyOperationLine(id=1, assembly_variant_id=1, sequence=1, operation_name="A", duration_seconds=360, quantity_per_item=1),
            AssemblyOperationLine(id=2, assembly_variant_id=1, sequence=2, operation_name="B", duration_seconds=240, quantity_per_item=2),
            TechnicalCard(id=1, order_group_id=1, card_seq=1, number="CAP-TC", quantity=Decimal("100"), product_model_id=1, assembly_variant_id=1),
        ])
        db.flush()
        db.add_all([TechnicalCardOperationLine(technical_card_id=1, sequence=i, source_kind="sewing", operation_name=name,
                                               volume_unit="pieces", volume=0, production_stage_id=4) for i, name in [(1, "A"), (2, "B")]])
        db.commit()
    user = PlatformUser(id=1, login="planner", roles=[Role(code="planner", name="Planner", permissions=[Permission(code=PERM_TECHNICAL_CARDS_CREATE)])])

    def override_db():
        with factory() as db:
            yield db

    original = dict(app.dependency_overrides)
    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_current_platform_user] = lambda: user
    try:
        with TestClient(app) as client:
            yield client, engine, factory, user
    finally:
        app.dependency_overrides.clear()
        app.dependency_overrides.update(original)
        engine.dispose()


def settings(**changes):
    return {"staff_count": 5, "hours_per_day": "8", "working_days": [0, 1, 2, 3, 4], "work_center_id": None, "note": None} | changes


def save(client, key="sewers", **changes):
    response = client.put(BASE + "/settings/" + key, json=settings(**changes))
    assert response.status_code == 200, response.text
    return response.json()


def load(client, key="sewers", day="2026-10-05", unit="person_hours", demands=None):
    response = client.post(BASE + "/load-state", json={"resource_key": key, "date": day, "demands": demands if demands is not None else [{"unit": unit, "technical_card_id": 1}]})
    assert response.status_code == 200, response.text
    return response.json()


def test_unconfigured_catalog_is_read_only_slim_and_batched(capacity_client):
    client, engine, factory, _ = capacity_client
    queries = []

    def track(_, __, statement, ___, ____, _____):
        if statement.lstrip().upper().startswith("SELECT"):
            queries.append(statement)

    event.listen(engine, "before_cursor_execute", track)
    try:
        result = client.get(BASE + "/settings").json()
    finally:
        event.remove(engine, "before_cursor_execute", track)
    assert len(queries) == 4
    assert len(result["resources"]) == 14
    assert len({row["key"] for row in result["resources"]}) == 14
    assert all(row["configured"] is False and row["base_capacity"] is None for row in result["resources"])
    milestone = next(row for row in result["resources"] if row["key"] == "procurement")
    assert milestone["production_stage_id"] is None and milestone["editable_fields"] == []
    with factory() as db:
        assert db.scalar(select(func.count()).select_from(ProductionCapacitySettings)) == 0
    assert load(client)["state"] == "unknown"


def test_settings_and_exception_upsert_reload_delete_and_source_preserved(capacity_client):
    client, _, factory, _ = capacity_client
    row = save(client, working_days=[4, 0, 1, 2, 3], note="Пять швей")
    assert Decimal(row["base_capacity"]) == 40 and row["working_days"] == [0, 1, 2, 3, 4]
    path = BASE + "/settings/sewers/exceptions/2026-10-10"
    response = client.put(path, json={"capacity": "24", "unavailable": False, "note": "Рабочая суббота"})
    assert response.status_code == 200 and Decimal(response.json()["capacity"]) == 24
    assert load(client, day="2026-10-10")["capacity"] == "24.0000"
    assert client.put(path, json={"capacity": None, "unavailable": True, "note": "Нет швей"}).status_code == 200
    assert load(client, day="2026-10-10")["state"] == "over"
    reloaded = next(row for row in client.get(BASE + "/settings").json()["resources"] if row["key"] == "sewers")
    assert reloaded["exceptions"] == [{"date": "2026-10-10", "capacity": None, "unavailable": True, "note": "Нет швей"}]
    assert client.delete(path).status_code == 204
    assert client.delete(path).status_code == 404
    assert load(client, day="2026-10-10")["capacity"] == "0"
    with factory() as db:
        assert db.scalar(select(func.count()).select_from(ProductionCapacitySettings)) == 1
        assert db.scalar(select(func.count()).select_from(ProductionCapacityException)) == 0
        card = db.get(TechnicalCard, 1)
        assert card.quantity == Decimal("100") and card.status == "draft"


@pytest.mark.parametrize("change", [
    {"staff_count": -1}, {"staff_count": 1.5}, {"hours_per_day": "25"}, {"hours_per_day": "-1"},
    {"hours_per_day": "NaN"}, {"hours_per_day": "Infinity"}, {"hours_per_day": "1.00001"},
    {"working_days": [0, 0]}, {"working_days": [7]}, {"working_days": [-1]}, {"quantity": 12},
])
def test_reject_invalid_settings(capacity_client, change):
    client, _, _, _ = capacity_client
    assert client.put(BASE + "/settings/sewers", json=settings(**change)).status_code == 422


@pytest.mark.parametrize("payload", [
    {"capacity": "-1"}, {"capacity": "NaN"}, {"capacity": "Infinity"}, {"capacity": "1.00001"},
    {"capacity": "1", "unavailable": True}, {"capacity": None, "unavailable": False}, {"capacity": "1", "extra": True},
])
def test_reject_invalid_exceptions(capacity_client, payload):
    client, _, _, _ = capacity_client
    save(client)
    assert client.put(BASE + "/settings/sewers/exceptions/2026-10-05", json=payload).status_code == 422


def test_permissions_unknown_resources_and_milestone(capacity_client):
    client, _, _, user = capacity_client
    assert client.put(BASE + "/settings/missing", json=settings()).status_code == 404
    assert client.put(BASE + "/settings/procurement", json=settings()).status_code == 422
    assert client.put(BASE + "/settings/sewers/exceptions/2026-10-05", json={"capacity": "1"}).status_code == 404
    save(client)
    assert client.put(BASE + "/settings/sewers/exceptions/2026-02-30", json={"capacity": "1"}).status_code == 422
    milestone = load(client, key="procurement", unit="milestone", demands=[])
    assert milestone["state"] == "unknown" and milestone["reason"] == "milestone" and milestone["capacity"] is None
    user.roles = []
    assert client.get(BASE + "/settings").status_code == 200
    assert client.post(BASE + "/load-state", json={"resource_key": "sewers", "date": "2026-10-05", "demands": []}).status_code == 200
    assert client.put(BASE + "/settings/sewers", json=settings()).status_code == 403
    assert client.put(BASE + "/settings/sewers/exceptions/2026-10-05", json={"capacity": "1"}).status_code == 403
    assert client.delete(BASE + "/settings/sewers/exceptions/2026-10-05").status_code == 403
    app.dependency_overrides.pop(get_current_platform_user)
    assert client.get(BASE + "/settings").status_code == 401
    assert client.post(BASE + "/load-state", json={"resource_key": "sewers", "date": "2026-10-05", "demands": []}).status_code == 401


def test_equipment_reuse_unique_binding_and_existing_catalog_delete(capacity_client):
    client, _, _, _ = capacity_client
    for center_id in [None, 999, 6, 8]:
        assert client.put(BASE + "/settings/plotter_1", json=settings(staff_count=None, work_center_id=center_id)).status_code == 422
    assert Decimal(save(client, "plotter_1", staff_count=None, work_center_id=1)["base_capacity"]) == 8
    assert client.put(BASE + "/settings/plotter_2", json=settings(staff_count=None, work_center_id=1)).status_code == 409
    assert Decimal(save(client, "plotter_2", staff_count=None, work_center_id=2)["base_capacity"]) == 8
    assert client.put(BASE + "/settings/designers", json=settings(work_center_id=1)).status_code == 422
    assert client.delete("/work-centers/1").status_code == 204
    resource = next(row for row in client.get(BASE + "/settings").json()["resources"] if row["key"] == "plotter_1")
    assert resource["work_center_id"] is None and resource["base_capacity"] is None
    assert load(client, "plotter_1", unit="linear_meter", demands=[{"unit": "linear_meter", "running_meters": "15"}])["state"] == "unknown"


@pytest.mark.parametrize("hours,state", [("0", "reserve"), ("31.9999", "reserve"), ("32", "near"), ("40", "near"), ("40.0001", "over")])
def test_thresholds_without_unit_mixing(capacity_client, hours, state):
    client, _, _, _ = capacity_client
    save(client, "designers")
    row = load(client, "designers", demands=[{"unit": "person_hours", "hours": hours, "quantity": "10000"}])
    assert row["state"] == state and row["known_planned_hours"] == hours
    assert row["warning_only"] is True
    assert client.post(BASE + "/load-state", json={"resource_key": "designers", "date": "2026-10-05", "demands": [{"unit": "machine_hours", "hours": "1"}]}).status_code == 422


def test_unknown_is_not_zero_and_zero_capacity_never_divides(capacity_client):
    client, _, _, _ = capacity_client
    save(client, "designers", staff_count=0)
    missing = load(client, "designers", demands=[{"unit": "person_hours"}, {"unit": "person_hours", "hours": "2"}])
    assert missing["state"] == "unknown" and missing["known_planned_hours"] == "2" and missing["unknown_demand_count"] == 1
    assert missing["load_percent"] is None
    over = load(client, "designers", demands=[{"unit": "person_hours", "hours": "2"}])
    assert over["state"] == "over" and over["load_percent"] is None
    empty = load(client, "designers", demands=[])
    assert empty["state"] == "unknown" and empty["reason"] == "zero_capacity"


def test_print_calender_laser_and_operator_units(capacity_client):
    client, _, _, _ = capacity_client
    for i in range(1, 5):
        save(client, f"plotter_{i}", staff_count=None, hours_per_day="10", work_center_id=i)
        row = load(client, f"plotter_{i}", unit="linear_meter", demands=[{"unit": "linear_meter", "running_meters": "150"}])
        assert row["known_planned_hours"] == "10" and row["state"] == "near"
        assert row["unit"] == "linear_meter"
    save(client, "calender", staff_count=None, hours_per_day="10", work_center_id=5)
    assert load(client, "calender", unit="linear_meter", demands=[{"unit": "linear_meter", "running_meters": "600"}])["known_planned_hours"] == "10"
    save(client, "laser", staff_count=None, hours_per_day="10", work_center_id=6)
    assert load(client, "laser", unit="item", demands=[{"unit": "item", "quantity": "1000"}])["known_planned_hours"] == "10"
    save(client, "laser_operator", staff_count=1, hours_per_day="10")
    assert load(client, "laser_operator", demands=[{"unit": "person_hours", "quantity": "1000"}])["state"] == "unknown"
    assert load(client, "laser_operator", demands=[{"unit": "person_hours", "hours": "2"}])["known_planned_hours"] == "2"
    assert load(client, "plotter_1", unit="linear_meter", demands=[{"unit": "linear_meter", "quantity": "1000"}])["state"] == "unknown"


def test_cutting_uses_one_pool_and_packing_crew_not_double_capacity(capacity_client):
    client, _, _, _ = capacity_client
    save(client, "cutters", staff_count=2, hours_per_day="10")
    mixed = load(client, "cutters", unit="item", demands=[{"unit": "item", "quantity": "200", "method": "manual_single"},
                                                         {"unit": "item", "quantity": "400", "method": "manual_lay"}])
    assert mixed["capacity"] == "20.0000" and mixed["known_planned_hours"] == "20" and mixed["load_percent"] == "100"
    assert client.put(BASE + "/settings/cutters", json=settings(staff_count=3)).status_code == 422
    assert client.put(BASE + "/settings/packing_team", json=settings(staff_count=2, hours_per_day="10")).status_code == 422
    save(client, "packing_team", staff_count=1, hours_per_day="10")
    packed = load(client, "packing_team", unit="item", demands=[{"unit": "item", "quantity": "800"}])
    assert packed["capacity"] == "10.0000" and packed["known_planned_hours"] == "10" and packed["load_percent"] == "100"
    stored = client.get(BASE + "/resources/packing_team").json()
    assert stored["capacity_unit"] == "item" and stored["resource_count"] == 1
    assert Decimal(stored["base_rate"]) == Decimal("80")


def test_sewing_existing_applicable_variant_norm_and_missing_zero_ambiguity(capacity_client):
    client, _, factory, _ = capacity_client
    save(client)
    row = load(client)
    assert Decimal(row["known_planned_hours"]) == Decimal(840) * 100 / 3600
    assert row["state"] == "reserve" and row["unknown_demand_count"] == 0
    assert client.post(BASE + "/load-state", json={"resource_key": "sewers", "date": "2026-10-05", "demands": [{"unit": "person_hours", "technical_card_id": 1, "hours": "0"}]}).status_code == 422
    with factory() as db:
        db.get(AssemblyOperationLine, 1).duration_seconds = 0
        db.commit()
    row = load(client, demands=[{"unit": "person_hours", "technical_card_id": 1, "quantity": "0"}])
    assert row["state"] == "unknown" and row["unknown_demand_count"] == 1 and row["reason"] == "norm_missing"
    with factory() as db:
        db.get(AssemblyOperationLine, 1).duration_seconds = 360
        db.add(AssemblyOperationLine(assembly_variant_id=1, sequence=3, operation_name="A", duration_seconds=50, quantity_per_item=1))
        db.commit()
    assert load(client)["reason"] == "norm_unverified"


def test_order_item_snapshot_authoritative_no_live_variant_fallback(capacity_client):
    client, _, factory, _ = capacity_client
    with factory() as db:
        customer = Client(contact_name="Capacity QA")
        db.add(customer)
        db.flush()
        order = SalesOrder(number="CAP-SO", title="Capacity snapshot QA", client_id=customer.id)
        db.add(order)
        db.flush()
        item = SalesOrderItem(order_id=order.id, snapshot_name="Форма", quantity=100, unit_price=0, discount_amount=0, line_amount=0, vat_amount=0)
        db.add(item)
        db.flush()
        card = db.get(TechnicalCard, 1)
        card.order_group_id = None
        card.sales_order_id = order.id
        card.sales_order_item_id = item.id
        db.commit()
        item_id = item.id
    save(client)
    assert load(client)["reason"] == "norm_missing"
    with factory() as db:
        db.add_all([SalesOrderItemAssemblyOperationSnapshot(order_item_id=item_id, sequence=i, operation_name=name,
                                                           duration_seconds=seconds, quantity_per_item=1) for i, name, seconds in [(1, "A", 180), (2, "B", 180)]])
        db.get(AssemblyOperationLine, 1).duration_seconds = 10000
        db.commit()
    row = load(client)
    assert Decimal(row["known_planned_hours"]) == 10 and row["state"] == "reserve"


def test_inactive_stage_and_missing_machine_do_not_gain_capacity_from_exceptions(capacity_client):
    client, _, factory, _ = capacity_client
    save(client, "plotter_1", staff_count=None, work_center_id=1)
    assert client.put(BASE + "/settings/plotter_1/exceptions/2026-10-05", json={"capacity": "10"}).status_code == 200
    with factory() as db:
        db.get(WorkCenter, 1).is_active = False
        db.commit()
    assert load(client, "plotter_1", unit="linear_meter", demands=[])["state"] == "unknown"
    save(client, "designers")
    with factory() as db:
        db.get(ProductionStage, 1).is_active = False
        db.commit()
    assert load(client, "designers", demands=[])["state"] == "unknown"
    assert client.put(BASE + "/settings/designers", json=settings()).status_code == 422


def test_sewing_batch_norm_queries_do_not_scale_with_demands(capacity_client):
    client, engine, _, _ = capacity_client
    save(client)
    queries = []

    def track(_, __, statement, ___, ____, _____):
        if statement.lstrip().upper().startswith("SELECT"):
            queries.append(statement)

    event.listen(engine, "before_cursor_execute", track)
    try:
        one = load(client)
        single_count = len(queries)
        queries.clear()
        many = load(client, demands=[{"unit": "person_hours", "technical_card_id": 1}] * 100)
        assert len(queries) == single_count == 7  # 4 settings + cards / TC lines / variant lines
        assert Decimal(many["known_planned_hours"]) == pytest.approx(Decimal(one["known_planned_hours"]) * 100)
    finally:
        event.remove(engine, "before_cursor_execute", track)
