"""Shared presentation of real Demand and scheduler reasons; no new planning rules."""
from dataclasses import dataclass
from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.production_capacity import CapacityResource, TechOperationCapacityResource
from app.models.production_stage import ProductionStage
from app.models.shop_routing import WorkCenter
from app.models.tech_operation import TechOperation
from app.models.technical_card import TechnicalCard
from app.schemas.production_diagnostics import DiagnosticTraceStep, ProductionDiagnostic, ProductionDiagnosticsRead
from app.services.route_readiness import operation_demand_result, _views, _text, affecting_node_ids


@dataclass
class DiagnosticContext:
    operations: dict[int, TechOperation]
    resources: dict[str, CapacityResource]
    linked: dict[int, list[CapacityResource]]
    stages: dict[int, ProductionStage]
    centers: dict[int, WorkCenter]


def context_from_operations(rows: list[TechOperation]) -> DiagnosticContext:
    """Catalog inputs are already batch loaded; never fetch per operation."""
    linked = {row.id: list(row.capacity_resources) for row in rows}
    resources = {resource.resource_key: resource for group in linked.values() for resource in group}
    stages = {row.production_stage.id: row.production_stage for row in rows if row.production_stage is not None}
    stages.update({row.production_stage.id: row.production_stage for row in resources.values() if row.production_stage is not None})
    centers = {row.work_center.id: row.work_center for row in resources.values() if row.work_center is not None}
    return DiagnosticContext({row.id: row for row in rows}, resources, linked, stages, centers)


def load_context(db: Session, operation_ids: set[int]) -> DiagnosticContext:
    operations = {row.id: row for row in db.scalars(select(TechOperation).where(TechOperation.id.in_(operation_ids)))}
    links = list(db.scalars(select(TechOperationCapacityResource).where(TechOperationCapacityResource.tech_operation_id.in_(operation_ids))))
    resources = {row.resource_key: row for row in db.scalars(select(CapacityResource).where(CapacityResource.resource_key.in_({row.resource_key for row in links})))}
    stages = {row.id: row for row in db.scalars(select(ProductionStage))}
    centers = {row.id: row for row in db.scalars(select(WorkCenter).where(WorkCenter.id.in_({row.work_center_id for row in resources.values() if row.work_center_id})))}
    linked = {key: [resources[link.resource_key] for link in links if link.tech_operation_id == key and link.resource_key in resources] for key in operation_ids}
    return DiagnosticContext(operations, resources, linked, stages, centers)


FIELDS = {
    "missing_resource_link": ("capacity_resource_keys", "Ресурсы мощности", "tech_operation"),
    "missing_operation": ("tech_operation_id", "Техоперация", "tech_operation"),
    "missing_operator_norm": ("calculation_mode", "Как рассчитывается потребность", "capacity_resource"),
    "missing_fixed_norm": ("calculation_mode", "Как рассчитывается потребность", "capacity_resource"),
    "unsupported_calculation_mode": ("calculation_mode", "Как рассчитывается потребность", "capacity_resource"),
    "capacity_unit_mismatch": ("capacity_unit", "В чём измеряется загрузка", "capacity_resource"),
    "missing_cutting_mode": ("cutting_method", "Способ раскроя", "technical_card"),
    "missing_cutting_rate": ("norm_rates.manual_single_items_per_person_hour", "Норма раскроя поштучно", "capacity_resource"),
    "route_snapshot_mismatch": ("production_stage_id", "Цех операции", "tech_operation"),
    "missing_linear_meters": ("volume", "Объём операции", "technical_card"),
    "ambiguous_operation_volume": ("volume", "Объём операции", "technical_card"),
    "invalid_quantity": ("quantity", "Количество изделий", "technical_card"),
    "missing_sewing_norm": ("assembly_variant_id", "Сборка изделия / нормы пошива", "technical_card"),
    "sewing_norm_unverified": ("assembly_variant_id", "Сборка изделия / нормы пошива", "technical_card"),
    "resource_capacity_not_configured": ("base_rate", "Производительность", "capacity_resource"),
    "resource_unavailable": ("include_in_calendar_load", "Учитывать при планировании", "capacity_resource"),
    "active_step_operation_required": ("is_active", "Активна", "tech_operation"),
    "resource_stage_inactive": ("production_stage_id", "Цех ресурса", "capacity_resource"),
    "no_compatible_active_machine": ("work_center_id", "Оборудование", "work_center"),
    "machine_binding_missing": ("production_stage_id", "Цех оборудования", "work_center"),
    "variant_not_selected": ("selected_operation_snapshot_node_id", "Вариант операции", "route_variant"),
    "missing_route": ("routing_template_id", "Маршрут", "technical_card"),
    "active_route_required": ("routing_template_id", "Маршрут", "technical_card"),
    "plan_locked": ("plan_locked", "План заблокирован", "technical_card"),
    "120_day_horizon_exhausted": ("planning_start_date", "Дата начала планирования / доступные мощности", "technical_card"),
    "quantity_planning_start_shipping_required": ("planning_start_date", "Дата начала планирования / дата отгрузки / количество", "technical_card"),
}


def diagnostic(code: str, context: DiagnosticContext, *, operation_id: int | None = None,
               resource_key: str | None = None, card: TechnicalCard | None = None,
               field: str | None = None, group_id: str | None = None) -> ProductionDiagnostic:
    field_name, label, scope = FIELDS.get(code, ("production_plan", "Производственный план", "technical_card"))
    operation = context.operations.get(operation_id)
    resource = context.resources.get(resource_key)
    if code == "missing_operator_norm" and operation is not None:
        field_name = "demand_rule" if operation.demand_rule not in {"fixed_per_order", "per_item"} else "demand_duration_seconds"
        label = "Правило расчёта потребности" if field_name == "demand_rule" else "Норма времени"
        scope = "tech_operation"
        resource = None
        resource_key = None
    if code == "missing_cutting_mode" and operation is not None and operation.code != "manual-cut":
        field_name, label, scope = "code", "Код операции", "tech_operation"
    if code == "120_day_horizon_exhausted" and resource is not None:
        field_name, label, scope = "working_days", "Рабочие дни", "capacity_resource"
    name = operation.name if operation is not None else "Операция"
    entity_type, entity_id, entity_name = "tech_operation", operation_id or 0, name
    if scope == "capacity_resource" and resource is not None:
        entity_type, entity_id, entity_name = scope, resource.resource_key, resource.name or resource.resource_key
    elif scope == "work_center" and resource is not None:
        center = context.centers.get(resource.work_center_id)
        entity_type, entity_id, entity_name = scope, resource.work_center_id or resource.resource_key, center.name if center else resource.name or resource.resource_key
    elif scope in {"technical_card", "route_variant"} and card is not None:
        entity_type, entity_id, entity_name = scope, group_id or card.id, card.number
    if field is not None:
        field_name = field
        label = {"hours_per_day": "Рабочих часов в день", "shifts_per_day": "Смен в день",
                 "efficiency": "Коэффициент эффективности", "resource_count": "Количество сотрудников",
                 "working_days": "Рабочие дни",
                 "norm_rates.manual_lay_items_per_person_hour": "Норма раскроя настилом"}.get(field, label)
    prefix = f"Операция «{name}»" if operation is not None else f"{entity_name}"
    location = f", ресурс «{resource.name or resource.resource_key}»" if resource is not None else ""
    explanation = "не настроено производственное правило" if code in {"missing_operator_norm", "missing_fixed_norm"} else "требуется исправление"
    if code == "missing_operator_norm" and operation is not None:
        return ProductionDiagnostic(code=code, entity_type=entity_type, entity_id=entity_id, entity_name=entity_name,
                                    field=field_name, field_label=label, fix_scope=scope, operation_id=operation_id,
                                    message=f"Операция «{name}»: не заполнено поле «{label}».")
    return ProductionDiagnostic(code=code, entity_type=entity_type, entity_id=entity_id, entity_name=entity_name,
                                field=field_name, field_label=label, fix_scope=scope, operation_id=operation_id,
                                resource_key=resource_key, message=f"{prefix}{location}: {explanation} для поля «{label}».")


def resolve_details(row: ProductionDiagnostic, *, context: DiagnosticContext | None = None) -> ProductionDiagnostic:
    """Add safe lineage to the existing DTO, shared by every diagnostic surface."""
    if row.expected_source is not None:
        return row
    category = "CONFIGURATION"
    if row.code in {"missing_operation", "broken_reference"}:
        category = "INTEGRITY"
    elif row.code in {"route_snapshot_mismatch", "ambiguous_operation_volume", "sewing_norm_unverified"}:
        category = "DATA_FLOW"
    elif row.code in {"120_day_horizon_exhausted", "plan_locked"}:
        category = "RUNTIME"
    if row.code == "120_day_horizon_exhausted" and context is not None:
        resource = context.resources.get(row.resource_key)
        if resource is not None and not resource.working_days:
            category = "CONFIGURATION"
    module = "demand"
    if row.fix_scope in {"capacity_resource", "work_center"}:
        module = "capacity"
    elif row.code == "variant_not_selected":
        module = "routing"
    elif category == "RUNTIME":
        module = "scheduler"
    if category == "RUNTIME":
        module = "scheduler"
    source = f"{row.fix_scope}.{row.field}"
    actual = None
    if context is not None:
        owner = context.operations.get(row.operation_id)
        if row.fix_scope == "capacity_resource":
            owner = context.resources.get(row.resource_key)
        elif row.fix_scope == "work_center":
            owner = context.centers.get(row.entity_id)
        if owner is not None:
            value = getattr(owner, row.field, None)
            actual = value if isinstance(value, (str, int, bool, float, list, dict)) else None if value is None else str(value)
    paths = {"tech_operation": "/settings/catalogs/tech-operations", "capacity_resource": "/production/calendar/capacity",
             "work_center": "/settings/catalogs/work-centers", "technical_card": f"/production/tech-cards/{row.entity_id}"}
    return row.model_copy(update=dict(category=category, module=module, expected_source=source,
        source_value=actual, actual_value=actual, reason=row.code, fix_action=f"Review {source} and save the verified input",
        fix_url=paths.get(row.fix_scope), fix_target=dict(entity_type=row.entity_type, entity_id=row.entity_id, field=row.field),
        trace=(DiagnosticTraceStep(source=source, value=actual, broken=True),)))


def unique(rows) -> tuple[ProductionDiagnostic, ...]:
    # Additive UI-safe JSON metadata makes the DTO intentionally unhashable.
    return tuple({row.model_dump_json(): row for row in (resolve_details(item) for item in rows)}.values())


def operation_diagnostics(context: DiagnosticContext, operation_id: int, workshop_id: int | None = None, *, demand_result=None, card=None):
    operation = context.operations.get(operation_id)
    if operation is None:
        return (resolve_details(diagnostic("missing_operation", context, operation_id=operation_id), context=context),)
    rows = []
    stage_id = workshop_id or operation.production_stage_id
    if stage_id in context.stages and context.stages[stage_id].code == "launch_preparation":
        return ()
    if not operation.is_active or (stage_id is not None and (stage_id not in context.stages or not context.stages[stage_id].is_active)):
        rows.append(diagnostic("active_step_operation_required", context, operation_id=operation_id))
    resources = context.linked.get(operation_id, [])
    from app.services.production_scheduler import eligible_machine_keys
    machines = [row for row in resources if row.resource_type == "machine"]
    eligible = eligible_machine_keys((row.resource_key for row in machines), context.resources, context.centers, stage_id)
    if machines:
        if not eligible:
            rows.append(diagnostic("no_compatible_active_machine", context, operation_id=operation_id, resource_key=machines[0].resource_key))
        resources = [row for row in resources if row.resource_type != "machine" or row.resource_key in eligible]
    result = demand_result if demand_result is not None else operation_demand_result(operation_id=operation_id, operation_name=operation.name, operation_code=operation.code,
                                    operation_stage_id=operation.production_stage_id, volume_unit=_text(operation.volume_unit),
                                    workshop_id=workshop_id or operation.production_stage_id or 1, resources=_views(resources),
                                    demand_rule=operation.demand_rule, demand_duration_seconds=operation.demand_duration_seconds)
    for issue in result.issues:
        if issue.reason_code == "missing_resource_link" and machines and not eligible:
            continue  # The links exist; Scheduler reports the incompatible equipment instead.
        if issue.resource_key is not None and context.resources[issue.resource_key].resource_type == "machine" and issue.resource_key not in eligible:
            continue
        detail = next((d.details for d in result.demands if d.resource_key == issue.resource_key), {})
        field = "norm_rates." + detail["rate_key"] if issue.reason_code == "missing_cutting_rate" and detail.get("rate_key") else None
        rows.append(diagnostic(issue.reason_code, context, operation_id=operation_id, resource_key=issue.resource_key, field=field, card=card))
    # Same capacity function as Scheduler; this is a settings check, not an occupancy forecast.
    from app.services.production_scheduler import _capacity
    for resource in resources:
        if resource.calculation_mode == "milestone" or resource.resource_type == "milestone" or not resource.include_in_calendar_load:
            continue
        if not resource.working_days:
            item = diagnostic("120_day_horizon_exhausted", context, operation_id=operation_id, resource_key=resource.resource_key)
            if resource.resource_type == "machine" and any(other.working_days for other in resources if other.resource_type == "machine" and other.resource_key != resource.resource_key):
                item = item.model_copy(update={"severity": "warning"})
            rows.append(item)
            continue
        day = next((date(2026, 1, 5) + timedelta(days=i) for i in range(7) if i in resource.working_days), date(2026, 1, 5))
        rate = None
        for demand in result.demands:
            if demand.resource_key == resource.resource_key and demand.details.get("items_per_person_hour"):
                from decimal import Decimal
                rate = Decimal(str(demand.details["items_per_person_hour"]))
        if _capacity(resource, day, None, rate) is None:
            required = ["hours_per_day", "shifts_per_day", "efficiency"]
            if resource.resource_type != "machine":
                required.append("resource_count")
            required.append("base_rate")
            missing = next((key for key in required
                            if getattr(resource, key) is None), "base_rate")
            if resource.calculation_mode == "team_rate" and resource.resource_count != 1:
                missing = "resource_count"
            if resource.calculation_mode == "cutting_methods" and rate is None and missing == "base_rate":
                continue  # Demand already names the missing cutting method/norm; base_rate is not its source.
            item = diagnostic("resource_capacity_not_configured", context, operation_id=operation_id, resource_key=resource.resource_key, field=missing)
            if resource.resource_type == "machine" and any(_capacity(other, day, None, None) is not None for other in resources if other.resource_type == "machine" and other.resource_key != resource.resource_key):
                item = item.model_copy(update={"severity": "warning"})
            rows.append(item)
        if resource.production_stage_id not in context.stages or not context.stages[resource.production_stage_id].is_active:
            rows.append(diagnostic("resource_stage_inactive", context, operation_id=operation_id, resource_key=resource.resource_key))
        if resource.resource_type == "machine":
            center = context.centers.get(resource.work_center_id)
            if center is None or not center.is_active or center.production_stage_id != resource.production_stage_id:
                rows.append(diagnostic("no_compatible_active_machine", context, operation_id=operation_id, resource_key=resource.resource_key))
    return unique(resolve_details(row, context=context) for row in rows)


def graph_diagnostics(db: Session, graph, selections=None):
    context = load_context(db, {node.tech_operation_id for node in graph.nodes})
    per_node = {node.id: operation_diagnostics(context, node.tech_operation_id, node.workshop_id) for node in graph.nodes}
    affects = affecting_node_ids(graph, selections)
    rows = [row for node in graph.nodes if affects.get(node.id, True) for row in per_node[node.id]]
    for group in graph.variant_groups:
        selected = group.default_operation_node_id if selections is None else selections.get(group.id)
        if group.active and selected not in {member.operation_node_id for member in group.members}:
            rows.append(ProductionDiagnostic(code="variant_not_selected", entity_type="route_variant", entity_id=group.id,
                                             entity_name=group.name, field="default_operation_node_id" if selections is None else "selected_operation_snapshot_node_id",
                                             field_label="Вариант операции", fix_scope="route_variant",
                                             message=f"Группа «{group.name}»: не выбран вариант операции."))
    return per_node, unique(rows)


def card_diagnostics(db: Session, card_id: int) -> ProductionDiagnosticsRead:
    from app.services.production_demand_snapshot import load_card_demand_snapshot
    from app.services.production_demand import calculate_demands, calculate_step_demands
    from app.services.production_scheduler import schedule_card_in_transaction
    from app.services.technical_cards import TechnicalCardNotFoundError
    card = db.get(TechnicalCard, card_id)
    if card is None:
        raise TechnicalCardNotFoundError("Technical card not found")
    from app.services.operation_retention import card_missing_operation_issues
    retained_issues = card_missing_operation_issues(db, card)
    from app.services.production_state import load_states
    load_states(db,[card])
    from app.services.technical_card_fact_projection import fact_integrity_issues
    retained_issues.extend(fact_integrity_issues(card))
    from pydantic import ValidationError
    try:
        snapshot = load_card_demand_snapshot(db, card_id)
    except ValidationError:
        from app.services.route_verification import route_review_issue
        review = route_review_issue(db, card)
        if review:
            return ProductionDiagnosticsRead(status="blocked", diagnostics=(review, *retained_issues))
        from app.services.production_lineage import lineage_issue
        issue = lineage_issue(card, "invalid_variant_snapshot", "INTEGRITY", "route_variant_groups",
                              "RoutingVariantGroup schema", "valid persisted groups", "invalid persisted groups")
        return ProductionDiagnosticsRead(status="blocked", diagnostics=(issue, *retained_issues))
    context = load_context(db, {step.operation_id for step in snapshot.steps if step.operation_id is not None})
    rows = []
    for step in snapshot.steps:
        rows.extend(operation_diagnostics(context, step.operation_id, step.production_stage_id,
                                           demand_result=calculate_step_demands(snapshot, step), card=card))
    for group_id in snapshot.unresolved_variant_groups:
        group = next(group for group in card.route_variant_groups if group["id"] == group_id)
        rows.append(ProductionDiagnostic(code="variant_not_selected", entity_type="route_variant", entity_id=group_id,
                                         entity_name=group["name"], field="selected_operation_snapshot_node_id",
                                         field_label="Вариант операции", fix_scope="route_variant",
                                         message=f"Группа «{group['name']}»: не выбран вариант операции."))
    demand = calculate_demands(snapshot)
    for issue in demand.issues:
        if issue.reason_code == "variant_not_selected":
            continue
        rows.append(diagnostic(issue.reason_code, context, operation_id=issue.operation_id, resource_key=issue.resource_key, card=card))
    # Existing dry-run engine returns its actual blocker. It never writes/commits or changes placement semantics.
    plan = schedule_card_in_transaction(db, card_id, persist=False)
    if plan.status == "blocked":
        for deviation in plan.deviations:
            if any(row.code == deviation.reason for row in rows):
                continue
            step = next((step for step in snapshot.steps if step.routing_stage_line_id == deviation.routing_stage_line_id), None)
            code = deviation.code if deviation.code == "variant_not_selected" else deviation.reason
            rows.append(resolve_details(diagnostic(code, context, operation_id=None if step is None else step.operation_id,
                                   resource_key=deviation.resource_key, card=card,
                                   group_id=deviation.reason if code == "variant_not_selected" else None), context=context))
    from app.services.production_lineage import card_lineage_diagnostics
    rows = card_lineage_diagnostics(db, card, rows, snapshot)
    from app.services.calendar_diagnostics import card_calendar_evidence
    calendar_assignments, calendar_issues = card_calendar_evidence(db, card)
    from app.services.calendar_plan_linkage import card_linkage_issues
    calendar_issues.extend(card_linkage_issues(db, card.id))
    from app.services.calendar_allocation_consistency import card_consistency
    calendar_issues.extend(card_consistency(db, card.id))
    from app.services.calendar_plan_freshness import card_stale_issues
    calendar_issues.extend(card_stale_issues(db, card.id))
    from app.services.route_reapply import reapply_diagnostics
    rows.extend(reapply_diagnostics(db, card))
    calendar_codes = {row.code for row in calendar_issues} | {"started_step_without_saved_plan"}
    rows = [row for row in rows if row.code not in calendar_codes]
    rows.extend(calendar_issues)
    from app.services.route_verification import route_review_issue
    review = route_review_issue(db, card)
    if review:
        rows = [r for r in rows if r.code not in {review.code, "route_snapshot_missing"}]
        rows.append(review)
    rows = unique(rows)
    rows = unique([*rows, *retained_issues])
    return ProductionDiagnosticsRead(status="blocked" if any(row.severity == "error" for row in rows) else "ready", diagnostics=rows,
                                     calendar_assignments=calendar_assignments)
