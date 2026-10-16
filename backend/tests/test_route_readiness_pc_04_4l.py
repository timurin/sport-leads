"""Route readiness follows the Demand resolver, including explicit_hours missing_operator_norm."""
from decimal import Decimal

from app.models.production_capacity import CapacityResource, TechOperationCapacityResource
from app.models.shop_routing import ShopRoutingStageLine
from app.models.tech_operation import TechOperation
from app.schemas.routing_graph import RoutingGraph, RoutingOperationNode, RoutingVariantGroup, RoutingVariantMember, RoutingWorkshop
from app.services.production_demand_snapshot import ResourceView
from app.services.route_readiness import affecting_node_ids, demand_readiness_message, operation_demand_gap
from app.services.route_snapshot import append_snapshot_line
from app.services.routing_graph import read_template_graph
from tests.test_production_scheduler_pc_04_3a import TODAY, run, scheduler


def view(mode, unit, kind, rates=None):
    return ResourceView(
        resource_key="resource", calculation_mode=mode, capacity_unit=unit, resource_type=kind,
        include_in_calendar_load=True, norm_rates=rates,
    )


def gap(mode, unit, kind, code="op", rates=None):
    return operation_demand_gap(
        operation_id=10, operation_name="Подготовка макетов", operation_code=code,
        operation_stage_id=1, volume_unit="pieces", workshop_id=1,
        resources=(view(mode, unit, kind, rates),),
    )


def test_configured_demand_rules_stay_ready_and_missing_norm_blocks():
    assert gap("rate", "item", "throughput") is None
    assert gap("sewing_norm", "labor_hour", "labor") is None
    assert gap("team_rate", "item", "labor") is None
    assert gap("milestone", None, "milestone") is None
    assert gap("cutting_methods", "item", "labor", code="manual-cut", rates={
        "manual_single_items_per_person_hour": "20",
        "manual_lay_items_per_person_hour": "40",
    }) is None
    assert gap("explicit_hours", "labor_hour", "labor") == "missing_operator_norm"
    assert gap("explicit_hours", "machine_hour", "machine") == "missing_operator_norm"
    assert demand_readiness_message("missing_operator_norm", "Подготовка макетов") == (
        "Не настроена производственная норма операции «Подготовка макетов»."
    )


def test_one_of_readiness_uses_only_the_default_or_selected_member():
    graph = RoutingGraph(
        workshops=(RoutingWorkshop(workshop_id=1),),
        nodes=(
            RoutingOperationNode(id="ready", workshop_id=1, tech_operation_id=1, position=1),
            RoutingOperationNode(id="blocked", workshop_id=1, tech_operation_id=2, position=2),
        ),
        variant_groups=(RoutingVariantGroup(
            id="cut", workshop_id=1, name="Способ раскроя", default_operation_node_id="ready",
            members=(RoutingVariantMember(operation_node_id="ready", position=1), RoutingVariantMember(operation_node_id="blocked", position=2)),
        ),),
    )
    assert affecting_node_ids(graph) == {"ready": True, "blocked": False}
    assert affecting_node_ids(graph, {"cut": "blocked"}) == {"ready": False, "blocked": True}


def test_preprint_schedule_blocker_matches_route_readiness(scheduler):
    factory, _ = scheduler
    with factory() as db:
        operation = db.get(TechOperation, 2)
        operation.name = "Подготовка макетов"
        operation.code = "preprint"
        db.add(CapacityResource(
            resource_key="print_operator", name="Оператор печати", resource_type="labor", capacity_unit="labor_hour",
            calculation_mode="explicit_hours", production_stage_id=1, staff_count=1, hours_per_day=Decimal("10"),
            working_days=list(range(5)), shifts_per_day=1, efficiency=1,
        ))
        db.flush()
        db.add(TechOperationCapacityResource(tech_operation_id=2, resource_key="print_operator"))
        line = ShopRoutingStageLine(
            id=2, routing_template_id=1, stage_order=2, stage_label="Подготовка",
            production_stage_id=1, tech_operation_id=2,
        )
        db.add(line)
        db.flush()
        from app.models.technical_card import TechnicalCard
        assert append_snapshot_line(db, db.get(TechnicalCard, 1), line) is not None
        db.commit()
    blocked = run(factory, 1)
    assert blocked.status == "blocked"
    assert blocked.deviations[0].reason == "missing_operator_norm"
    with factory() as db:
        readiness = {row.operation_id: row for row in read_template_graph(db, 1).node_readiness}
    assert readiness[1].status == "ready" and readiness[1].affects_route is True
    preprint = readiness[2]
    assert preprint.status == "blocked"
    assert preprint.reason_code == blocked.deviations[0].reason
    assert preprint.operation_name == "Подготовка макетов"
    assert preprint.message == "Не настроена производственная норма операции «Подготовка макетов»."
    assert preprint.affects_route is True
