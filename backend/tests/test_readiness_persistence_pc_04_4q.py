"""A capacity base_rate is not an explicit operation demand norm."""
from decimal import Decimal

import pytest
from sqlalchemy import select

from tests.test_production_scheduler_pc_04_3a import scheduler
from tests.test_scheduler_scenarios_pc_04_3c import scenario_api
from tests.test_production_diagnostics_pc_04_4m import preprint
from app.models.production_capacity import CapacityResource
from app.models.tech_operation import TechOperation
from app.services.production_demand import read_technical_card_demand
from app.services.production_scheduler import schedule_card


@pytest.mark.parametrize("rule,seconds,expected", [("fixed_per_order", 1800, Decimal("0.5")), ("per_item", 18, Decimal("0.5"))])
def test_capacity_norm_cannot_replace_operation_rule_and_roundtrip(scenario_api, rule, seconds, expected):
    factory, client = scenario_api
    preprint(factory)
    with factory() as db:
        resource = db.get(CapacityResource, "operator")
        resource.base_rate = Decimal("100")
        db.commit()

    def diagnostics():
        operation = client.get("/tech-operations/2").json()
        routing = client.get("/shop-routings/1/graph").json()
        card = client.get("/technical-cards/1/production-diagnostics").json()
        return [body["diagnostics"] for body in (operation, routing, card)]

    before = diagnostics()
    blockers = [next(row for row in rows if row["code"] == "missing_operator_norm") for rows in before]
    assert blockers[0] == blockers[1] == blockers[2]
    assert blockers[0]["field"] == "demand_rule"
    response = client.patch("/tech-operations/2", json={"demand_rule": rule, "demand_duration_seconds": seconds})
    assert response.status_code == 200
    with factory() as db:
        stored = db.execute(select(TechOperation.demand_rule, TechOperation.demand_duration_seconds).where(TechOperation.id == 2)).one()
        assert stored == (rule, seconds)
        assert db.get(CapacityResource, "operator").base_rate == Decimal("100")
        demand = read_technical_card_demand(db, 1).steps[1].demands[0]
        assert demand.status == "ready" and Decimal(demand.amount) == expected
        result = schedule_card(db, 1, persist=False)
        assert result.status == "planned" and not result.persisted
    get = client.get("/tech-operations/2").json()
    assert (get["demand_rule"], get["demand_duration_seconds"]) == stored
    assert all(not any(row["code"] == "missing_operator_norm" for row in rows) for rows in diagnostics())
    # Unrelated PATCH cannot erase the persisted source.
    assert client.patch("/tech-operations/2", json={"name": "Дизайн"}).status_code == 200
    assert client.get("/tech-operations/2").json()["demand_rule"] == rule
