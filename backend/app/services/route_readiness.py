"""Route readiness uses the Demand resolver. A filled work schedule is not a demand rule."""

from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.production_capacity import CapacityResource, TechOperationCapacityResource
from app.models.tech_operation import TechOperation
from app.schemas.routing_graph import RouteNodeReadiness, RoutingGraph
from app.services.production_demand import calculate_step_demands
from app.services.production_demand_snapshot import (
    AppliedSewingRow,
    CardDemandSnapshot,
    DemandStep,
    ResourceView,
    SewingSource,
    VolumeRow,
)

STRUCTURAL_DEMAND_REASONS = frozenset({
    "missing_operator_norm",
    "missing_fixed_norm",
    "missing_resource_link",
    "missing_operation",
    "missing_cutting_mode",
    "missing_cutting_rate",
    "capacity_unit_mismatch",
    "unsupported_calculation_mode",
    "route_snapshot_mismatch",
})


def demand_readiness_message(reason: str, operation_name: str) -> str:
    quoted = f" «{operation_name}»" if operation_name else ""
    if reason == "missing_cutting_mode":
        return f"Не настроен способ раскроя операции{quoted}."
    if reason in {"missing_operator_norm", "missing_fixed_norm", "missing_cutting_rate"}:
        return f"Не настроена производственная норма операции{quoted}."
    if reason in {"missing_resource_link", "capacity_unit_mismatch"}:
        return f"Для операции{quoted} не настроена мощность."
    return "Маршрут или операция ещё не готовы к расчёту."


def operation_demand_result(
    *,
    operation_id: int,
    operation_name: str,
    operation_code: str | None,
    operation_stage_id: int | None,
    volume_unit: str | None,
    workshop_id: int,
    resources: tuple[ResourceView, ...],
    demand_rule: str | None = None,
    demand_duration_seconds: int | None = None,
):
    """Structural Demand gap for one operation. Card inputs are supplied by a probe."""
    stage_id = workshop_id or operation_stage_id or 1
    step = DemandStep(
        routing_stage_line_id=1,
        routing_template_id=0,
        stage_order=1,
        stage_label="readiness",
        production_stage_id=stage_id,
        operation_id=operation_id,
        operation_name=operation_name,
        operation_stage_id=operation_stage_id,
        operation_volume_unit=volume_unit,
        resources=resources,
        operation_code=operation_code,
        demand_rule=demand_rule,
        demand_duration_seconds=demand_duration_seconds,
    )
    snapshot = CardDemandSnapshot(
        technical_card_id=0,
        quantity=Decimal("1"),
        routing_template_id=0,
        sales_order_item_id=None,
        sewing_unverified=False,
        sewing_sources=(SewingSource(
            id=1, sewing_operation_id=1, operation_name="readiness-sewing",
            duration_seconds=60, quantity_per_item=1, norm_table="route_readiness_probe",
        ),),
        applied_sewing=(AppliedSewingRow(
            id=1, sewing_operation_id=1, operation_name="readiness-sewing",
            stage_order=step.stage_order, production_stage_id=stage_id,
        ),),
        volumes=(VolumeRow(
            id=1, tech_operation_id=operation_id, stage_order=step.stage_order, production_stage_id=stage_id,
            volume=Decimal("1"), volume_unit="linear_meters",
            cutting_method="manual_single" if operation_code == "manual-cut" else None,
        ),),
        steps=(step,),
    )
    return calculate_step_demands(snapshot, step)


def operation_demand_gap(**kwargs) -> str | None:
    for issue in operation_demand_result(**kwargs).issues:
        if issue.reason_code in STRUCTURAL_DEMAND_REASONS:
            return issue.reason_code
    return None


def affecting_node_ids(graph: RoutingGraph, selections: dict[str, str | None] | None = None) -> dict[str, bool]:
    """ONE OF contributes only its selected member, or the default when the card has not chosen."""
    chosen: dict[str, bool] = {}
    for group in graph.variant_groups:
        members = {member.operation_node_id for member in group.members}
        if not group.active:
            chosen.update(dict.fromkeys(members, False))
            continue
        selected = (selections or {}).get(group.id)
        if selected not in members and selections is None:
            selected = group.default_operation_node_id if group.default_operation_node_id in members else None
        chosen.update({member: member == selected for member in members})
    return chosen


def _views(rows: list[CapacityResource]) -> tuple[ResourceView, ...]:
    return tuple(
        ResourceView(
            resource_key=row.resource_key,
            calculation_mode=row.calculation_mode,
            capacity_unit=row.capacity_unit,
            resource_type=row.resource_type,
            include_in_calendar_load=bool(row.include_in_calendar_load),
            norm_rates=row.norm_rates if isinstance(row.norm_rates, dict) else None,
        )
        for row in sorted(rows, key=lambda row: row.resource_key)
    )


def _text(value: object | None) -> str | None:
    if value is None:
        return None
    return value.value if hasattr(value, "value") else str(value)


def graph_node_readiness(
    db: Session,
    graph: RoutingGraph,
    selections: dict[str, str | None] | None = None,
) -> tuple[RouteNodeReadiness, ...]:
    operation_ids = {node.tech_operation_id for node in graph.nodes}
    operations = {
        row.id: row for row in db.scalars(select(TechOperation).where(TechOperation.id.in_(operation_ids)))
    } if operation_ids else {}
    links = list(db.scalars(
        select(TechOperationCapacityResource).where(TechOperationCapacityResource.tech_operation_id.in_(operation_ids))
    )) if operation_ids else []
    keys = {link.resource_key for link in links}
    resources = {
        row.resource_key: row for row in db.scalars(select(CapacityResource).where(CapacityResource.resource_key.in_(keys)))
    } if keys else {}
    linked = {
        operation_id: _views([resources[link.resource_key] for link in links if link.tech_operation_id == operation_id and link.resource_key in resources])
        for operation_id in operation_ids
    }
    affects = affecting_node_ids(graph, selections)
    rows = []
    for node in graph.nodes:
        operation = operations.get(node.tech_operation_id)
        name = operation.name if operation is not None else "Операция"
        reason = None if operation is None else operation_demand_gap(
            operation_id=operation.id,
            operation_name=name,
            operation_code=operation.code,
            operation_stage_id=operation.production_stage_id,
            volume_unit=_text(operation.volume_unit),
            workshop_id=node.workshop_id,
            resources=linked.get(operation.id, ()),
            demand_rule=operation.demand_rule,
            demand_duration_seconds=operation.demand_duration_seconds,
        )
        if operation is None:
            reason = "missing_operation"
        rows.append(RouteNodeReadiness(
            node_id=node.id,
            operation_id=node.tech_operation_id,
            operation_name=name,
            status="blocked" if reason else "ready",
            reason_code=reason,
            message=None if reason is None else demand_readiness_message(reason, name),
            affects_route=affects.get(node.id, True),
        ))
    return tuple(rows)
