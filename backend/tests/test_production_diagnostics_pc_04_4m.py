"""One root-cause diagnostic across operation, routing and effective card runtime."""
from copy import deepcopy
from decimal import Decimal

import pytest
from sqlalchemy import select, event

from tests.test_production_scheduler_pc_04_3a import scheduler, run
from tests.test_scheduler_scenarios_pc_04_3c import scenario_api
from tests.test_route_variants_pc_04_4i import seed_variant, patch
from tests.test_work_center_scheduler_pc_04_4d import plotters
from app.models.production_capacity import CapacityResource, TechOperationCapacityResource
from app.models.shop_routing import ShopRoutingStageLine
from app.models.tech_operation import TechOperation
from app.models.technical_card import TechnicalCard
from app.services.tech_operations import get_tech_operation, list_tech_operations
from app.services.routing_graph import read_template_graph, read_card_graph
from app.services.production_diagnostics import card_diagnostics
from app.services.route_snapshot import append_snapshot_line


def preprint(factory):
    with factory() as db:
        op = db.get(TechOperation, 2)
        op.name = "Подготовка макетов к печати"
        op.code = "preprint"
        db.add(CapacityResource(resource_key="operator", name="Оператор печати", resource_type="labor", capacity_unit="labor_hour",
                                calculation_mode="explicit_hours", production_stage_id=1, staff_count=1, hours_per_day=8,
                                working_days=list(range(7)), shifts_per_day=1, efficiency=1))
        db.flush()
        db.add(TechOperationCapacityResource(tech_operation_id=2, resource_key="operator"))
        line = ShopRoutingStageLine(id=2, routing_template_id=1, stage_order=2, stage_label="Подготовка", production_stage_id=1, tech_operation_id=2)
        db.add(line)
        db.flush()
        append_snapshot_line(db, db.get(TechnicalCard, 1), line)
        db.commit()


def issue(rows, code):
    return next(row for row in rows if row.code == code)


def test_same_diagnostic_on_all_levels_and_disappears_after_root_fix(scheduler):
    factory, _ = scheduler
    preprint(factory)
    with factory() as db:
        operation = issue(get_tech_operation(db, 2).diagnostics, "missing_operator_norm")
        routing = issue(read_template_graph(db, 1).diagnostics, "missing_operator_norm")
        card = issue(card_diagnostics(db, 1).diagnostics, "missing_operator_norm")
        assert operation == routing == card
        assert operation.field == "demand_rule" and operation.fix_scope == "tech_operation"
        assert operation.entity_id == 2 and operation.resource_key is None
        assert "Подготовка макетов к печати" in operation.message and operation.field_label in operation.message
        assert issue(read_card_graph(db, 1).diagnostics, "missing_operator_norm") == operation
        assert issue(list_tech_operations(db)[1].diagnostics, "missing_operator_norm") == operation
    blocked = run(factory)
    assert blocked.deviations[0].reason == operation.code
    with factory() as db:
        # Use an existing supported runtime rule, no new operator norm or manager input.
        resource = db.get(CapacityResource, "operator")
        resource.calculation_mode = "rate"
        resource.resource_type = "throughput"
        resource.capacity_unit = "item"
        resource.base_rate = 100
        db.commit()
        assert not get_tech_operation(db, 2).diagnostics
        assert not read_template_graph(db, 1).diagnostics
        assert card_diagnostics(db, 1).status == "ready"
    assert run(factory).status == "planned"


@pytest.mark.parametrize("field", ["hours_per_day", "base_rate", "resource_count"])
def test_missing_capacity_never_false_green_and_names_exact_field(scheduler, field):
    factory, _ = scheduler
    with factory() as db:
        setattr(db.get(CapacityResource, "items"), field, None)
        db.commit()
        op = issue(get_tech_operation(db, 1).diagnostics, "resource_capacity_not_configured")
        assert op.field == field
        assert op == issue(read_template_graph(db, 1).diagnostics, op.code)
        assert op == issue(card_diagnostics(db, 1).diagnostics, op.code)
        assert card_diagnostics(db, 1).status == "blocked"
    assert run(factory).deviations[0].reason == op.code


def test_one_of_only_default_selected_blocks_and_snapshot_stays_immutable(scheduler):
    factory, _ = scheduler
    nodes = seed_variant(factory)
    with factory() as db:
        resource = db.get(CapacityResource, "laser")
        resource.calculation_mode = "explicit_hours"
        resource.resource_type = "labor"
        resource.capacity_unit = "labor_hour"
        db.commit()
        assert get_tech_operation(db, 2).diagnostics
        graph = read_template_graph(db, 1)
        assert not graph.diagnostics
        assert any(row.diagnostics and not row.affects_route for row in graph.node_readiness)
        assert card_diagnostics(db, 3).status == "ready"
        before = deepcopy(db.get(TechnicalCard, 3).route_variant_groups)
    result = patch(factory, nodes[4])
    assert result.requires_replan
    with factory() as db:
        assert not read_template_graph(db, 1).diagnostics  # template still uses its own default
        assert issue(card_diagnostics(db, 3).diagnostics, "missing_operator_norm") == issue(get_tech_operation(db, 2).diagnostics, "missing_operator_norm")
        assert db.get(TechnicalCard, 3).route_variant_groups == before


def test_missing_variant_default_or_choice_is_not_ready(scheduler):
    factory, _ = scheduler
    seed_variant(factory, None)
    with factory() as db:
        assert issue(read_template_graph(db, 1).diagnostics, "variant_not_selected")
        assert issue(card_diagnostics(db, 3).diagnostics, "variant_not_selected")


def test_read_only_api_and_batch_query_count(scenario_api):
    factory, client = scenario_api
    preprint(factory)
    assert client.get("/tech-operations/2").status_code == 200
    assert client.get("/technical-cards/999/production-diagnostics").status_code == 404
    body = client.get("/technical-cards/1/production-diagnostics").json()
    assert body["status"] == "blocked"
    assert next(row for row in body["diagnostics"] if row["code"] == "missing_operator_norm") == next(row for row in client.get("/tech-operations/2").json()["diagnostics"] if row["code"] == "missing_operator_norm")
    engine = factory.kw["bind"]
    with factory() as db:
        resource = db.get(CapacityResource, "items")
        for index in range(3, 43):
            db.add(TechOperation(id=index, name=f"Batch operation {index}", code=f"batch-{index}", volume_unit="pieces",
                                 production_stage_id=1, capacity_resources=[resource]))
        db.commit()
    writes, reads = [], []
    def track(_, __, sql, ___, ____, _____):
        (reads if sql.lstrip().upper().startswith("SELECT") else writes).append(sql)
    with factory() as db:
        event.listen(engine, "before_cursor_execute", track)
        try:
            assert len(list_tech_operations(db)) == 42
            count = len(reads)
            assert count <= 10
            assert not writes
            reads.clear()
            card_diagnostics(db, 1)
            assert not writes
        finally:
            event.remove(engine, "before_cursor_execute", track)


def test_invalid_or_unconfigured_machine_alternative_does_not_block_other_machine(plotters):
    from app.models.shop_routing import WorkCenter
    with plotters() as db:
        db.get(WorkCenter, 1).is_active = False
        db.get(CapacityResource, "plotter-test-3").hours_per_day = None
        db.commit()
        result = card_diagnostics(db, 1)
        assert result.status == "ready"
        assert any(row.severity == "warning" and row.entity_id == "plotter-test-3" for row in result.diagnostics)
    assert run(plotters).status == "planned"


def test_card_input_failure_is_local_and_empty_template_not_green(scheduler):
    from app.models.shop_routing import ShopRoutingTemplate
    factory, _ = scheduler
    with factory() as db:
        db.get(CapacityResource, "items").capacity_unit = "linear_meter"
        db.get(TechOperation, 1).volume_unit = "linear_meters"
        db.add(ShopRoutingTemplate(id=2, name="Empty"))
        db.commit()
        assert not get_tech_operation(db, 1).diagnostics
        actual = card_diagnostics(db, 1)
        row = issue(actual.diagnostics, "missing_linear_meters")
        assert actual.status == "blocked" and row.entity_type == "technical_card" and row.entity_id == 1
        assert row.field == "volume"
        assert read_template_graph(db, 2).diagnostics[0].code == "missing_route"


def test_empty_work_schedule_names_resource_and_matches_scheduler(scheduler):
    factory, _ = scheduler
    with factory() as db:
        resource = db.get(CapacityResource, "items")
        resource.working_days = []
        resource.name = None
        db.commit()
        row = issue(get_tech_operation(db, 1).diagnostics, "120_day_horizon_exhausted")
        assert row.entity_name == "items" and row.field == "working_days"
        assert row == issue(read_template_graph(db, 1).diagnostics, row.code)
        assert row == issue(card_diagnostics(db, 1).diagnostics, row.code)
    assert run(factory).deviations[0].reason == row.code
