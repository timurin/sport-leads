"""Stored admin time rule -> Decimal Demand -> unchanged Scheduler/diagnostics."""
from dataclasses import replace
from decimal import Decimal
from pathlib import Path
from uuid import uuid4
import importlib.util

import pytest
from pydantic import ValidationError
from sqlalchemy import select, text, func
from sqlalchemy.exc import IntegrityError
from alembic.migration import MigrationContext
from alembic.operations import Operations

from tests.test_production_scheduler_pc_04_3a import scheduler, run
from tests.test_scheduler_scenarios_pc_04_3c import scenario_api
from tests.test_production_diagnostics_pc_04_4m import preprint, issue
from tests.test_route_variants_pc_04_4i import seed_variant, patch
from tests.test_route_variants_postgres_pc_04_4i import local_engine
from app.models.tech_operation import TechOperation
from app.models.production_capacity import CapacityResource
from app.models.calendar_allocation import CalendarAllocation
from app.models.calendar_assignment import CalendarAssignment
from app.schemas.tech_operation import TechOperationCreate, TechOperationUpdate
from app.services.tech_operations import get_tech_operation, update_tech_operation
from app.services.production_demand import calculate_step_demands, read_technical_card_demand
from app.services.production_demand_snapshot import load_card_demand_snapshot
from app.services.production_diagnostics import card_diagnostics
from app.services.routing_graph import read_template_graph, read_card_graph


@pytest.mark.parametrize("rule,seconds,quantity,expected", [
    ("fixed_per_order", 1800, "100", "0.5"),
    ("fixed_per_order", 3600, "0.001", "1"),
    ("per_item", 18, "100", "0.5"),
    ("per_item", 3600, "1.234", "1.234"),
    ("per_item", 18, "1.3", "0.0065"),
])
def test_exact_rule_demand_and_provenance(scheduler, rule, seconds, quantity, expected):
    factory, _ = scheduler
    preprint(factory)
    with factory() as db:
        update_tech_operation(db, 2, TechOperationUpdate(demand_rule=rule, demand_duration_seconds=seconds))
        snapshot = load_card_demand_snapshot(db, 1)
        snapshot = replace(snapshot, quantity=Decimal(quantity))
        step = snapshot.steps[1]
        row = calculate_step_demands(snapshot, step).demands[0]
        assert row.status == "ready" and row.amount == expected and row.unit == "labor_hour"
        assert row.details["demand_rule"] == rule
        assert row.details["demand_duration_seconds"] == str(seconds)
        assert row.details["norm_table"] == "tech_operations" and row.details["operation_id"] == 2
        assert row.source_type == ("fixed_per_card" if rule == "fixed_per_order" else "technical_card_quantity")


@pytest.mark.parametrize("rule,seconds,missing_field", [(None, None, "demand_rule"), (None, 60, "demand_rule"), ("per_item", None, "demand_duration_seconds")])
def test_missing_rule_or_value_identical_on_all_levels(scheduler, rule, seconds, missing_field):
    factory, _ = scheduler
    preprint(factory)
    with factory() as db:
        update_tech_operation(db, 2, TechOperationUpdate(demand_rule=rule, demand_duration_seconds=seconds))
        row = issue(get_tech_operation(db, 2).diagnostics, "missing_operator_norm")
        assert row.entity_type == "tech_operation" and row.entity_id == 2
        assert row.entity_name == "Подготовка макетов к печати" and row.field == missing_field and row.fix_scope == "tech_operation"
        assert row == issue(read_template_graph(db, 1).diagnostics, row.code)
        assert row == issue(read_card_graph(db, 1).diagnostics, row.code)
        assert row == issue(card_diagnostics(db, 1).diagnostics, row.code)
        update_tech_operation(db, 2, TechOperationUpdate(demand_rule="fixed_per_order", demand_duration_seconds=1800))
        assert not get_tech_operation(db, 2).diagnostics
        assert not read_template_graph(db, 1).diagnostics
        assert not card_diagnostics(db, 1).diagnostics
    assert run(factory).status == "planned"


@pytest.mark.parametrize("rule,seconds", [("fixed_per_order", 1800), ("per_item", 18)])
def test_real_scheduler_allocations_equal_demand_and_capacity_is_independent(scheduler, rule, seconds):
    factory, _ = scheduler
    preprint(factory)
    with factory() as db:
        update_tech_operation(db, 2, TechOperationUpdate(demand_rule=rule, demand_duration_seconds=seconds))
        before = read_technical_card_demand(db, 1).steps[1].demands[0]
        resource = db.get(CapacityResource, "operator")
        resource.staff_count = 2
        resource.hours_per_day = 4
        db.commit()
        assert read_technical_card_demand(db, 1).steps[1].demands[0] == before
    result = run(factory)
    assert result.status == "planned" and result.persisted
    with factory() as db:
        allocated = db.scalar(select(func.sum(CalendarAllocation.allocated_amount)).where(CalendarAllocation.resource_key == "operator"))
        assert allocated == Decimal("0.5")
        assert db.scalar(select(func.count()).select_from(CalendarAssignment).where(CalendarAssignment.technical_card_id == 1)) == 3


@pytest.mark.parametrize("seconds", [0, -1, 0.5, 1.0, True, 2147483648])
def test_invalid_duration_rejected(seconds):
    with pytest.raises(ValidationError):
        TechOperationUpdate(demand_duration_seconds=seconds)


def test_invalid_rule_and_partial_patch_and_additive_api(scenario_api):
    factory, client = scenario_api
    preprint(factory)
    assert client.patch("/tech-operations/2", json={"demand_rule": "guessed"}).status_code == 422
    assert client.patch("/tech-operations/2", json={"demand_duration_seconds": 0}).status_code == 422
    response = client.patch("/tech-operations/2", json={"demand_rule": "per_item"})
    assert response.status_code == 200 and response.json()["demand_rule"] == "per_item"
    assert issue(get_tech_operation_from_response(response), "missing_operator_norm").field == "demand_duration_seconds"
    response = client.patch("/tech-operations/2", json={"demand_duration_seconds": 18})
    assert response.status_code == 200 and response.json()["demand_rule"] == "per_item" and not response.json()["diagnostics"]
    assert client.get("/tech-operations/2").json()["demand_duration_seconds"] == 18
    assert next(row for row in client.get("/tech-operations").json() if row["id"] == 2)["demand_rule"] == "per_item"
    assert client.post("/technical-cards/1/schedule").json()["status"] == "planned"
    response = client.post("/tech-operations", json={"name": "New rule", "code": "new-rule", "volume_unit": "pieces",
                                                    "production_stage_id": 1, "capacity_resource_keys": ["operator"],
                                                    "demand_rule": "fixed_per_order", "demand_duration_seconds": 600})
    assert response.status_code == 201 and response.json()["demand_duration_seconds"] == 600


def get_tech_operation_from_response(response):
    from app.schemas.production_diagnostics import ProductionDiagnostic
    return [ProductionDiagnostic.model_validate(row) for row in response.json()["diagnostics"]]


def test_norm_only_used_by_explicit_hours_and_other_operations_unchanged(scheduler):
    factory, _ = scheduler
    with factory() as db:
        before = read_technical_card_demand(db, 1)
        update_tech_operation(db, 1, TechOperationUpdate(demand_rule="per_item", demand_duration_seconds=10000))
        assert read_technical_card_demand(db, 1) == before
    assert run(factory).status == "planned"


@pytest.mark.parametrize("unit", ["machine_hour", "team_hour"])
def test_explicit_rule_uses_resource_hour_unit_without_conversion_guess(scheduler, unit):
    factory, _ = scheduler
    preprint(factory)
    with factory() as db:
        snapshot = load_card_demand_snapshot(db, 1)
        step = snapshot.steps[1]
        step = replace(step, demand_rule="fixed_per_order", demand_duration_seconds=600,
                       resources=(replace(step.resources[0], capacity_unit=unit),))
        row = calculate_step_demands(snapshot, step).demands[0]
        assert row.status == "ready" and row.unit == unit
        assert Decimal(row.amount) == Decimal(600) / Decimal(3600)


def test_one_second_norm_is_decimal_and_scheduler_does_not_lose_work(scheduler):
    factory, _ = scheduler
    preprint(factory)
    with factory() as db:
        update_tech_operation(db, 2, TechOperationUpdate(demand_rule="fixed_per_order", demand_duration_seconds=1))
        row = read_technical_card_demand(db, 1).steps[1].demands[0]
        assert Decimal(row.amount) == Decimal(1) / Decimal(3600)
    result = run(factory)
    assert result.persisted
    assert sum(a.allocated_amount for step in result.steps for a in step.allocations if a.resource_key == "operator") == Decimal("0.0003")


def test_explicit_norm_applies_only_to_selected_one_of_member(scheduler):
    from copy import deepcopy
    from app.models.production_capacity import TechOperationCapacityResource
    from app.models.technical_card import TechnicalCard
    factory, _ = scheduler
    nodes = seed_variant(factory)
    with factory() as db:
        db.add(CapacityResource(resource_key="operator", name="Operator", resource_type="labor", capacity_unit="labor_hour",
                                calculation_mode="explicit_hours", production_stage_id=1, staff_count=1, hours_per_day=8,
                                working_days=list(range(7)), shifts_per_day=1, efficiency=1))
        db.flush()
        db.add(TechOperationCapacityResource(tech_operation_id=2, resource_key="operator"))
        db.commit()
        snapshot_groups = deepcopy(db.get(TechnicalCard, 3).route_variant_groups)
        assert card_diagnostics(db, 3).status == "ready"  # No norm is needed for the excluded laser member.
    assert run(factory, 3).persisted
    changed = patch(factory, nodes[4])
    assert changed.requires_replan and changed.plan.deviations[0].reason == "missing_operator_norm"
    with factory() as db:
        update_tech_operation(db, 2, TechOperationUpdate(demand_rule="per_item", demand_duration_seconds=18))
        health = card_diagnostics(db, 3)
        assert any(issue.code == "calendar_plan_stale_after_demand_change" for issue in health.diagnostics)
        assert db.get(TechnicalCard, 3).route_variant_groups == snapshot_groups
    result = run(factory, 3)
    assert result.persisted
    assert sum(a.allocated_amount for step in result.steps for a in step.allocations if a.resource_key == "operator") == Decimal("0.5")


def test_isolated_migration_cycle_legacy_null_and_constraints():
    engine = local_engine()
    schema = "pc044o_" + uuid4().hex
    path = Path(__file__).resolve().parents[1] / "alembic/versions/c9d0e1f2a345_tech_operation_demand_rule.py"
    spec = importlib.util.spec_from_file_location("explicit_demand_revision", path)
    revision = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(revision)
    with engine.connect() as connection:
        transaction = connection.begin()
        try:
            connection.execute(text("CREATE SCHEMA " + schema))
            connection.execute(text("SET LOCAL search_path TO " + schema))
            connection.execute(text("CREATE TABLE tech_operations(id integer PRIMARY KEY, name varchar(255))"))
            connection.execute(text("INSERT INTO tech_operations VALUES (1, 'Legacy')"))
            revision.op = Operations(MigrationContext.configure(connection))
            revision.upgrade()
            assert connection.execute(text("SELECT demand_rule, demand_duration_seconds FROM tech_operations")).one() == (None, None)
            connection.execute(text("UPDATE tech_operations SET demand_rule='per_item', demand_duration_seconds=600"))
            assert connection.execute(text("SELECT demand_rule, demand_duration_seconds FROM tech_operations")).one() == ("per_item", 600)
            for sql in ["UPDATE tech_operations SET demand_duration_seconds=0", "UPDATE tech_operations SET demand_rule='guessed'"]:
                checkpoint = connection.begin_nested()
                with pytest.raises(IntegrityError):
                    connection.execute(text(sql))
                checkpoint.rollback()
            revision.downgrade()
            assert connection.execute(text("SELECT id, name FROM tech_operations")).one() == (1, "Legacy")
            revision.upgrade()
            assert connection.execute(text("SELECT demand_rule, demand_duration_seconds FROM tech_operations")).one() == (None, None)
        finally:
            transaction.rollback()
            engine.dispose()
