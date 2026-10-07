from decimal import Decimal

import pytest
from sqlalchemy import event, func, select

from app.models.production_capacity import CapacityResource, TechOperationCapacityResource
from tests.test_production_capacity import capacity_client, save, load, BASE

RESOURCES = BASE + "/resources"


def resource(**changes):
    return {
        "name": "Shared operator", "production_stage_id": 2, "resource_type": "labor",
        "capacity_unit": "labor_hour", "resource_count": 2, "hours_per_day": "8",
        "working_days": [0, 1, 2, 3, 4], "calculation_mode": "explicit_hours",
    } | changes


def create_operation(client, code, keys=None):
    result = client.post("/tech-operations", json={"name": code, "code": code,
        "volume_unit": "linear_meters", "production_stage_id": 2,
        "capacity_resource_keys": keys or []})
    assert result.status_code == 201, result.text
    return result.json()


def test_shared_resource_links_crud_cross_editor_reload_and_single_storage(capacity_client):
    client, _, factory, _ = capacity_client
    created = client.put(RESOURCES + "/shared-print", json=resource())
    assert created.status_code == 200, created.text
    first = create_operation(client, "sublimation", ["shared-print"])
    second = create_operation(client, "heat_transfer", ["shared-print"])
    shared_path = f"/tech-operations/{first['id']}/capacity-resources/shared-print"
    changed = client.put(shared_path, json=resource(resource_count=3, efficiency="0.5", shifts_per_day=2))
    assert changed.status_code == 200, changed.text
    reloaded = client.get(f"/tech-operations/{second['id']}/capacity-resources").json()[0]
    assert reloaded["resource_count"] == 3 and reloaded["shifts_per_day"] == 2
    assert Decimal(reloaded["efficiency"]) == Decimal("0.5")
    assert Decimal(reloaded["hours_per_day"]) == 8
    state = load(client, "shared-print", demands=[{"unit": "person_hours", "hours": "12"},
                                                 {"unit": "person_hours", "hours": "12"}])
    assert Decimal(state["capacity"]) == 24 and Decimal(state["load_percent"]) == 100
    with factory() as db:
        assert db.scalar(select(func.count()).select_from(CapacityResource)) == 1
        assert db.scalar(select(func.count()).select_from(TechOperationCapacityResource)) == 2
    assert client.delete(RESOURCES + "/shared-print").status_code == 409
    for operation in [first, second]:
        assert client.patch(f"/tech-operations/{operation['id']}", json={"capacity_resource_keys": []}).status_code == 200
    assert client.delete(RESOURCES + "/shared-print").status_code == 204
    assert client.get(RESOURCES + "/shared-print").status_code == 404


def test_legacy_and_canonical_edits_share_availability_and_exceptions(capacity_client):
    client, _, _, _ = capacity_client
    save(client, "print_operator", staff_count=2)
    canonical = client.get(RESOURCES + "/print_operator").json()
    assert canonical["resource_type"] == "labor" and canonical["resource_count"] == 2
    canonical.pop("key"); canonical.pop("exceptions")
    canonical["resource_count"] = 4
    response = client.put(RESOURCES + "/print_operator", json=canonical)
    assert response.status_code == 200, response.text
    legacy = client.get(BASE + "/settings").json()["resources"]
    assert next(row for row in legacy if row["key"] == "print_operator")["staff_count"] == 4
    path = RESOURCES + "/print_operator/exceptions/2026-10-05"
    assert client.put(path, json={"unavailable": True, "capacity": None, "note": "Shared day off"}).status_code == 200
    assert client.get(RESOURCES + "/print_operator").json()["exceptions"][0]["unavailable"] is True
    assert load(client, "print_operator", demands=[{"unit": "person_hours", "hours": "1"}])["state"] == "over"
    assert client.delete(RESOURCES + "/print_operator").status_code == 409
    assert client.delete(path).status_code == 204


@pytest.mark.parametrize("changes", [
    {"resource_type": "labor", "capacity_unit": "machine_hour"},
    {"resource_type": "machine", "capacity_unit": "machine_hour", "work_center_id": 1, "resource_count": 2},
    {"resource_type": "throughput", "capacity_unit": "item", "calculation_mode": "rate"},
    {"resource_type": "milestone", "capacity_unit": None, "calculation_mode": "milestone"},
    {"efficiency": "1.01"}, {"efficiency": "NaN"}, {"base_rate": "0"},
    {"working_days": [0, 0]}, {"shifts_per_day": 4},
])
def test_resource_validation_no_mutation(capacity_client, changes):
    client, _, factory, _ = capacity_client
    assert client.put(RESOURCES + "/invalid", json=resource(**changes)).status_code == 422
    with factory() as db:
        assert db.get(CapacityResource, "invalid") is None


def test_milestone_machine_throughput_and_rate_modes(capacity_client):
    client, _, _, _ = capacity_client
    milestone = resource(resource_type="milestone", capacity_unit=None, calculation_mode="milestone",
                         resource_count=None, hours_per_day=None)
    assert client.put(RESOURCES + "/approval", json=milestone).status_code == 200
    assert load(client, "approval", unit="milestone", demands=[])["reason"] == "milestone"
    assert client.put(BASE + "/settings/approval/exceptions/2026-10-05", json={"capacity": "1"}).status_code == 422
    machine = resource(resource_type="machine", capacity_unit="machine_hour", resource_count=1,
                       work_center_id=1, calculation_mode="rate", base_rate="15")
    assert client.put(RESOURCES + "/printer", json=machine).status_code == 200
    state = load(client, "printer", unit="machine_hours", demands=[{"unit": "machine_hours", "running_meters": "120"}])
    assert Decimal(state["load_percent"]) == 100
    machine["work_center_id"] = 6
    assert client.put(RESOURCES + "/printer", json=machine).status_code == 422
    throughput = resource(resource_type="throughput", capacity_unit="item", calculation_mode="rate", base_rate="20")
    assert client.put(RESOURCES + "/output", json=throughput).status_code == 200
    state = load(client, "output", unit="item", demands=[{"unit": "item", "quantity": "320"}])
    assert Decimal(state["capacity"]) == 320 and Decimal(state["load_percent"]) == 100
    assert client.put(BASE + "/settings/output/exceptions/2026-10-05", json={"capacity": "100"}).status_code == 200
    state = load(client, "output", unit="item", demands=[{"unit": "item", "quantity": "200"}])
    assert Decimal(state["load_percent"]) == 200


def test_link_validation_unlink_does_not_delete_shared_resource(capacity_client):
    client, _, factory, _ = capacity_client
    assert client.put(RESOURCES + "/shared", json=resource()).status_code == 200
    operation = create_operation(client, "op", ["shared"])
    assert client.patch(f"/tech-operations/{operation['id']}", json={"resource_type": "labor"}).status_code == 422
    assert client.post("/tech-operations", json={"name": "Invalid inline capacity", "code": "inline",
        "volume_unit": "pieces", "capacity": resource()}).status_code == 422
    for keys in [["missing"], ["shared", "shared"], None]:
        response = client.patch(f"/tech-operations/{operation['id']}", json={"capacity_resource_keys": keys})
        assert response.status_code == 422
    assert client.get(f"/tech-operations/{operation['id']}").json()["capacity_resource_keys"] == ["shared"]
    assert client.delete(f"/tech-operations/{operation['id']}").status_code == 204
    with factory() as db:
        assert db.get(CapacityResource, "shared") is not None
        assert db.scalar(select(func.count()).select_from(TechOperationCapacityResource)) == 0


def test_resource_reads_batched_and_catalog_list_slim(capacity_client):
    client, engine, _, _ = capacity_client
    assert client.put(RESOURCES + "/shared", json=resource()).status_code == 200
    for index in range(5):
        create_operation(client, f"op-{index}", ["shared"])
    queries = []
    def track(_, __, statement, ___, ____, _____):
        if statement.lstrip().upper().startswith("SELECT"):
            queries.append(statement)
    event.listen(engine, "before_cursor_execute", track)
    try:
        rows = client.get("/tech-operations").json()
        assert len(rows) == 5 and all(row["capacity_resource_keys"] == ["shared"] for row in rows)
        assert len(queries) == 3  # operations, links/resources, empty material collection
        queries.clear()
        resources = client.get(RESOURCES).json()
        assert "exceptions" not in resources[0]
        assert len(queries) == 1
    finally:
        event.remove(engine, "before_cursor_execute", track)


def test_canonical_write_permission_and_excluded_load(capacity_client):
    client, _, _, user = capacity_client
    assert client.put(RESOURCES + "/excluded", json=resource(include_in_calendar_load=False)).status_code == 200
    state = load(client, "excluded", demands=[{"unit": "person_hours", "hours": "10"}])
    assert state["capacity"] is None and state["state"] == "unknown"
    user.roles = []
    assert client.put(RESOURCES + "/other", json=resource()).status_code == 403
    assert client.delete(RESOURCES + "/excluded").status_code == 403
