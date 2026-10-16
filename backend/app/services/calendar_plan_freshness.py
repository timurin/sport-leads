"""IC-G04: immutable audit input stamps and derived stale-plan state."""
from dataclasses import asdict
from decimal import Decimal
import hashlib
import json

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.audit import AuditEvent
from app.models.calendar_assignment import CalendarAssignment
from app.models.calendar_allocation import CalendarAllocation
from app.models.production_capacity import CapacityResource, ProductionCapacityException
from app.models.shop_routing import WorkCenter
from app.models.technical_card import TechnicalCardStageResult
from app.models.technical_card import TechnicalCard
from app.schemas.production_diagnostics import ProductionDiagnostic
from app.services.calendar_plan_linkage import PlanLinkageConflict

CODE = "calendar_plan_stale_after_demand_change"


def canonical(value):
    if isinstance(value, bool):
        return value
    if isinstance(value, (Decimal, int, float)):
        return format(Decimal(str(value)).normalize(), "f")
    if hasattr(value, "isoformat"):
        return value.isoformat()
    if isinstance(value, dict):
        return {str(k): canonical(v) for k, v in sorted(value.items())}
    if isinstance(value, (list, tuple)):
        return [canonical(v) for v in value]
    return value


def input_stamp(db: Session, assignment, *, resource_keys=None, batch: dict | None = None) -> dict | None:
    from app.services.production_demand import load_card_demand_snapshot, calculate_step_demands
    if batch is not None:
        if assignment.technical_card_id not in batch['snapshots']:
            batch['snapshots'][assignment.technical_card_id] = load_card_demand_snapshot(db, assignment.technical_card_id, batch=batch)
        snapshot = batch['snapshots'][assignment.technical_card_id]
    else:
        snapshot = load_card_demand_snapshot(db, assignment.technical_card_id)
    step = next((s for s in snapshot.steps if s.snapshot_node_id == assignment.stage_result_id), None) if snapshot else None
    if step is None:
        return None
    keys = set(resource_keys if resource_keys is not None else db.scalars(select(CalendarAllocation.resource_key)
        .where(CalendarAllocation.assignment_id == assignment.id)))
    views = [v for v in step.resources if v.resource_type != "machine" or v.resource_key in keys]
    from dataclasses import replace
    effective = replace(step, resources=tuple(views))
    computed = calculate_step_demands(snapshot, effective)
    modes = {v.calculation_mode for v in views}
    uses_quantity = any(v.calculation_mode in {"sewing_norm", "cutting_methods", "team_rate"} or
        (v.calculation_mode == "rate" and v.capacity_unit == "item") or
        (v.calculation_mode == "explicit_hours" and step.demand_rule == "per_item") for v in views)
    inputs = dict(node_id=step.snapshot_node_id, operation_id=step.operation_id,
        workshop_id=step.production_stage_id, stage_order=step.stage_order,
        predecessors=sorted(step.predecessor_ids), unresolved_variants=list(snapshot.unresolved_variant_groups),
        operation_volume_unit=step.operation_volume_unit)
    card = batch['cards'][assignment.technical_card_id] if batch is not None else db.get(TechnicalCard, assignment.technical_card_id)
    inputs["planning_constraints"] = dict(planning_start_date=card.planning_start_date, shipping_date=card.shipping_date, priority=card.priority)
    if uses_quantity:
        inputs["quantity"] = snapshot.quantity
    if "explicit_hours" in modes:
        inputs["operation_rule"] = dict(demand_rule=step.demand_rule, duration_seconds=step.demand_duration_seconds)
    if "sewing_norm" in modes:
        applied = [row for row in snapshot.applied_sewing if row.stage_order == step.stage_order and row.production_stage_id == step.production_stage_id]
        sources = [source for source in snapshot.sewing_sources if any(
            source.sewing_operation_id == row.sewing_operation_id if row.sewing_operation_id is not None
            else source.operation_name == row.operation_name for row in applied)]
        inputs["sewing"] = dict(unverified=snapshot.sewing_unverified,
            sources=[asdict(s) for s in sources], applied=[asdict(s) for s in applied])
    if "cutting_methods" in modes or any(v.capacity_unit == "linear_meter" for v in views):
        inputs["operation_volumes"] = [asdict(row) for row in snapshot.volumes if row.tech_operation_id == step.operation_id
            and row.stage_order == step.stage_order and row.production_stage_id == step.production_stage_id]
    capacity = {}
    for view in sorted(views, key=lambda v: v.resource_key):
        resource = batch['resources'].get(view.resource_key) if batch is not None else db.get(CapacityResource, view.resource_key)
        if resource is None:
            continue
        fields = ("resource_type", "capacity_unit", "calculation_mode", "include_in_calendar_load", "base_rate",
                  "staff_count", "hours_per_day", "shifts_per_day", "efficiency", "working_days", "work_center_id")
        config = {field: getattr(resource, field) for field in fields}
        if resource.capacity_unit not in {"item", "linear_meter"} or resource.calculation_mode == "cutting_methods":
            config.pop("base_rate")
        if resource.resource_type == "machine":
            config.pop("staff_count")
        if view.calculation_mode == "cutting_methods":
            rate_keys = {d.details.get("rate_key") for d in computed.demands if d.resource_key == view.resource_key}
            config["norm_rates"] = {key: (resource.norm_rates or {}).get(key) for key in rate_keys if key is not None}
            inputs["cutting_operation_code"] = step.operation_code
        if resource.work_center_id:
            center = batch['centers'].get(resource.work_center_id) if batch is not None else db.get(WorkCenter, resource.work_center_id)
            config["equipment"] = None if center is None else dict(active=center.is_active, workshop=center.production_stage_id)
        capacity[view.resource_key] = config
    inputs["capacity"] = capacity
    # Only overrides on dates of this saved span can affect its occupancy/ETA.
    if assignment.planned_date is not None:
        overrides = ([row for row in batch['exceptions'] if row.resource_key in capacity
                      and assignment.planned_date <= row.date <= assignment.planned_end_date]
                     if batch is not None else db.scalars(select(ProductionCapacityException).where(ProductionCapacityException.resource_key.in_(capacity),
                ProductionCapacityException.date >= assignment.planned_date,
                ProductionCapacityException.date <= assignment.planned_end_date).order_by(ProductionCapacityException.resource_key, ProductionCapacityException.date)))
        inputs["dated_capacity"] = [dict(resource=row.resource_key, date=row.date, unavailable=row.unavailable, capacity=row.capacity) for row in overrides]
    inputs = canonical(inputs)
    digest = hashlib.sha256(json.dumps(inputs, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
    return dict(version=1, fingerprint=digest, inputs=inputs,
                demand=canonical([dict(resource_key=d.resource_key, amount=d.amount, unit=d.unit, status=d.status) for d in computed.demands]))


def saved_stamp(db: Session, assignment) -> dict | None:
    for row in db.scalars(select(AuditEvent).where(AuditEvent.entity_type == "calendar_plan_lifecycle",
        AuditEvent.entity_id == str(assignment.technical_card_id), AuditEvent.action == "calendar.assignment_created")
        .order_by(AuditEvent.id.desc())):
        if (row.payload or {}).get("calendar_assignment_id") == assignment.id:
            return row.payload.get("demand_input_snapshot")
    return None


def stale_issue(db: Session, assignment) -> ProductionDiagnostic | None:
    if assignment.stage_result_id is None:
        return None
    previous, current = saved_stamp(db, assignment), input_stamp(db, assignment)
    if previous and current and previous["fingerprint"] == current["fingerprint"]:
        return None
    node = db.get(TechnicalCardStageResult, assignment.stage_result_id)
    before, after = (previous or {}).get("inputs", {}), (current or {}).get("inputs", {})
    changed = [key for key in sorted(before.keys() | after.keys()) if before.get(key) != after.get(key)] if previous else []
    protected = node is not None and node.status in {"in_progress", "completed"}
    return ProductionDiagnostic(code=CODE, category="INTEGRITY" if protected else "DATA_FLOW", module="calendar",
        entity_type="technical_card", entity_id=assignment.technical_card_id, entity_name=f"ТК {assignment.technical_card_id}",
        operation_id=None if node is None else node.tech_operation_id, field=f"production_plan.assignment.{assignment.id}.inputs",
        field_label="Актуальность производственного плана", message=f"План назначения {assignment.id} требует пересчёта: " + (", ".join(changed) if previous else "legacy inputs не подтверждены"),
        fix_scope="technical_card", expected_source="Canonical assignment_created demand_input_snapshot vs current effective inputs",
        source_value=previous, actual_value=current, reason="demand_inputs_changed" if previous else "legacy_inputs_unverifiable",
        fix_action="Пересчитать производственный план", fix_url=f"/production/tech-cards/{assignment.technical_card_id}",
        debug_details=dict(technical_card_id=assignment.technical_card_id, snapshot_node_id=assignment.stage_result_id,
            operation_id=None if node is None else node.tech_operation_id, assignment_id=assignment.id,
            changed_inputs=changed, previous_fingerprint=None if previous is None else previous["fingerprint"],
            current_fingerprint=None if current is None else current["fingerprint"], previous_inputs=before if previous else None,
            current_inputs=after if current else None, old_demand=None if previous is None else previous["demand"],
            current_demand=None if current is None else current["demand"], replan_required=True))


def assert_fresh(db: Session, assignment) -> None:
    issue = stale_issue(db, assignment)
    if issue:
        raise PlanLinkageConflict(issue)


def card_stale_issues(db: Session, card_id: int) -> list[ProductionDiagnostic]:
    issues = [issue for row in db.scalars(select(CalendarAssignment).where(CalendarAssignment.technical_card_id == card_id))
              if (issue := stale_issue(db, row)) is not None]
    history = list(db.scalars(select(AuditEvent).where(AuditEvent.entity_type == "calendar_plan_lifecycle",
        AuditEvent.entity_id == str(card_id)).order_by(AuditEvent.id.desc())))
    saved_generation = max((row.id for row in history if row.action == "calendar.assignment_created" and row.source == "scheduler"), default=0)
    retired = next((row for row in history if row.action == "calendar.assignment_deleted" and
        (row.payload or {}).get("reason") in {"snapshot_reapplied", "future_snapshot_reapplied", "route_variant_changed"}), None)
    if retired and retired.id > saved_generation:
        payload = retired.payload
        creation = next((row for row in history if row.id < retired.id and row.action == "calendar.assignment_created" and
            (row.payload or {}).get("calendar_assignment_id") == payload["calendar_assignment_id"]), None)
        previous = None if creation is None else creation.payload.get("demand_input_snapshot")
        issues.append(ProductionDiagnostic(code=CODE, category="DATA_FLOW", module="calendar", entity_type="technical_card",
            entity_id=card_id, entity_name=f"ТК {card_id}", operation_id=payload.get("tech_operation_id"),
            field="production_plan.retired_generation", field_label="Пересчёт производственного плана",
            message="Изменение применённого маршрута/ONE OF сняло будущий план; требуется явный пересчёт.",
            fix_scope="technical_card", expected_source="Canonical retired plan lifecycle", source_value=previous,
            actual_value=None, reason=payload["reason"], fix_action="Пересчитать производственный план", fix_url=f"/production/tech-cards/{card_id}",
            debug_details=dict(technical_card_id=card_id, snapshot_node_id=payload.get("snapshot_node_id"),
                operation_id=payload.get("tech_operation_id"), assignment_id=payload["calendar_assignment_id"],
                changed_inputs=["applied_route_or_one_of"], previous_fingerprint=None if previous is None else previous["fingerprint"],
                current_fingerprint=None, old_demand=None if previous is None else previous["demand"], current_demand=None,
                replan_required=True, historical_mapping=True)))
    return issues
