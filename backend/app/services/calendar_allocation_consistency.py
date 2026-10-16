"""IC-G03: daily date, exact-unit, selected-resource and demand-total checks."""
from decimal import Decimal, ROUND_CEILING
from dataclasses import replace
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.calendar_allocation import CalendarAllocation
from app.models.calendar_assignment import CalendarAssignment
from app.models.production_capacity import CapacityResource
from app.models.shop_routing import WorkCenter
from app.models.technical_card import TechnicalCardStageResult
from app.schemas.production_diagnostics import ProductionDiagnostic, DiagnosticTraceStep
from app.services.calendar_plan_linkage import PlanLinkageConflict

QUANTUM = Decimal("0.0001")


def diagnostic(db: Session, assignment, code: str, *, allocation=None, resource_key=None,
               expected=None, actual=None, reason=None) -> ProductionDiagnostic:
    node = db.get(TechnicalCardStageResult, assignment.stage_result_id) if assignment.stage_result_id else None
    resource = db.get(CapacityResource, resource_key) if resource_key else None
    details = dict(technical_card_id=assignment.technical_card_id, snapshot_node_id=assignment.stage_result_id,
        operation_id=None if node is None else node.tech_operation_id, assignment_id=assignment.id,
        allocation_id=None if allocation is None else getattr(allocation, "id", None), resource_key=resource_key,
        work_center_id=None if resource is None else resource.work_center_id, expected=expected, actual=actual,
        reason_code=reason or code)
    return ProductionDiagnostic(code=code, category="DATA_FLOW" if "amount" in code else "INTEGRITY",
        module="calendar", entity_type="technical_card", entity_id=assignment.technical_card_id,
        entity_name=f"ТК {assignment.technical_card_id}", operation_id=details["operation_id"], resource_key=resource_key,
        field=f"production_plan.assignment.{assignment.id}.{code}.{resource_key or ''}", field_label="Распределение нагрузки",
        message=f"Назначение {assignment.id}: {reason or code}. Проверить распределение производственного плана.",
        fix_scope="technical_card", expected_source="Current selected Demand -> assignment dates -> resource allocations",
        source_value=expected, actual_value=actual, reason=reason or code, debug_details=details,
        fix_action="Проверить текущую потребность, даты и ресурс; явно перепланировать будущий план. Факт и неизвестные данные не исправляются автоматически.",
        fix_url=f"/production/tech-cards/{assignment.technical_card_id}",
        trace=(DiagnosticTraceStep(source="Expected allocation", value=expected), DiagnosticTraceStep(source="Stored allocation", value=actual, broken=True)))


def assignment_consistency(db: Session, assignment, *, allocations=None, snapshot=None,
                           start=None, end=None) -> list[ProductionDiagnostic]:
    from app.services.production_demand import load_card_demand_snapshot, calculate_step_demands
    rows = list(db.scalars(select(CalendarAllocation).where(CalendarAllocation.assignment_id == assignment.id))) if allocations is None else list(allocations)
    if assignment.stage_result_id is None and not rows:
        return []  # Bare queue marker, not an operation plan.
    start, end = start or assignment.planned_date, end or assignment.planned_end_date
    issues = []
    if end < start:
        issues.append(diagnostic(db, assignment, "calendar_allocation_outside_assignment", expected="start <= end (inclusive dates)",
            actual={"start": start.isoformat(), "end": end.isoformat()}, reason="invalid_assignment_span"))
    for row in rows:
        resource = db.get(CapacityResource, row.resource_key)
        if not start <= row.date <= end:
            issues.append(diagnostic(db, assignment, "calendar_allocation_outside_assignment", allocation=row,
                resource_key=row.resource_key, expected={"start": start.isoformat(), "end": end.isoformat()}, actual=row.date.isoformat()))
        if resource is None or resource.capacity_unit is None or resource.capacity_unit != row.capacity_unit:
            issues.append(diagnostic(db, assignment, "calendar_allocation_unit_mismatch", allocation=row,
                resource_key=row.resource_key, expected=None if resource is None else resource.capacity_unit, actual=row.capacity_unit))
        if resource is not None:
            center = db.get(WorkCenter, resource.work_center_id) if resource.work_center_id else None
            if not resource.include_in_calendar_load or (resource.resource_type == "machine" and
                    (center is None or not center.is_active or center.production_stage_id != assignment.production_stage_id or
                     resource.production_stage_id != center.production_stage_id)):
                issues.append(diagnostic(db, assignment, "calendar_allocation_resource_mismatch", allocation=row,
                    resource_key=row.resource_key, expected="active physical WorkCenter / enabled resource", actual=resource.work_center_id))
    snapshot = snapshot or load_card_demand_snapshot(db, assignment.technical_card_id)
    step = next((s for s in snapshot.steps if s.snapshot_node_id == assignment.stage_result_id), None) if snapshot else None
    if step is None:
        if rows:
            issues.append(diagnostic(db, assignment, "calendar_allocation_resource_mismatch", expected="selected current snapshot node",
                                     actual=assignment.stage_result_id, reason="unselected_or_missing_snapshot"))
        return issues
    # Reuse the engine's physical-machine eligibility. An unavailable alternate
    # must not make the chosen valid machine's Demand unverified.
    if any(view.resource_type == "machine" for view in step.resources):
        from app.services.production_scheduler import eligible_machine_keys
        resources = {view.resource_key: db.get(CapacityResource, view.resource_key) for view in step.resources}
        centers = {resource.work_center_id: db.get(WorkCenter, resource.work_center_id)
                   for resource in resources.values() if resource and resource.work_center_id}
        eligible = eligible_machine_keys((view.resource_key for view in step.resources if view.resource_type == "machine"),
                                         resources, centers, step.production_stage_id)
        if not eligible:
            issues.append(diagnostic(db, assignment, "calendar_allocation_resource_mismatch", expected="eligible physical machine", actual=None))
        step = replace(step, resources=tuple(view for view in step.resources if view.resource_type != "machine" or view.resource_key in eligible))
    computed = calculate_step_demands(snapshot, step)
    linked_keys = {resource.resource_key for resource in step.resources}
    for row in rows:
        if row.resource_key not in linked_keys:
            issues.append(diagnostic(db, assignment, "calendar_allocation_resource_mismatch", allocation=row,
                resource_key=row.resource_key, expected=sorted(linked_keys), actual=row.resource_key, reason="resource_not_linked_to_operation"))
    ready = {d.resource_key: d for d in computed.demands if d.status == "ready"}
    for demand in computed.demands:
        if demand.details.get("reason_code") == "capacity_unit_mismatch":
            issues.append(diagnostic(db, assignment, "calendar_allocation_unit_mismatch", resource_key=demand.resource_key,
                expected=demand.details.get("expected_unit"), actual=demand.unit, reason="demand_capacity_unit_mismatch"))
    if computed.status not in {"ready", "not_applicable"}:
        issues.append(diagnostic(db, assignment, "calendar_allocation_amount_mismatch", expected=None,
            actual={key: str(sum((r.allocated_amount for r in rows if r.resource_key == key), Decimal(0))) for key in {r.resource_key for r in rows}},
            reason="current_demand_unverified"))
        return issues
    machines = {key for key in ready if (resource := db.get(CapacityResource, key)) is not None and resource.resource_type == "machine"}
    used = {row.resource_key for row in rows}
    selected_machines = used & machines
    if machines and len(selected_machines) != 1:
        issues.append(diagnostic(db, assignment, "calendar_allocation_resource_mismatch", expected="exactly one eligible machine",
            actual=sorted(selected_machines)))
    expected_keys = set(ready) - machines | selected_machines
    for key in used - set(ready):
        row = next(r for r in rows if r.resource_key == key)
        issues.append(diagnostic(db, assignment, "calendar_allocation_resource_mismatch", allocation=row, resource_key=key,
            expected=sorted(ready), actual=key, reason="resource_not_in_selected_demand"))
    for key in expected_keys:
        demand = ready[key]
        actual = sum((row.allocated_amount for row in rows if row.resource_key == key), Decimal(0))
        expected = Decimal(demand.amount).quantize(QUANTUM, rounding=ROUND_CEILING)
        if actual != expected:
            issues.append(diagnostic(db, assignment, "calendar_allocation_amount_mismatch", resource_key=key,
                expected=str(expected), actual=str(actual)))
        for row in rows:
            if row.resource_key == key and row.capacity_unit != demand.unit:
                issues.append(diagnostic(db, assignment, "calendar_allocation_unit_mismatch", allocation=row,
                    resource_key=key, expected=demand.unit, actual=row.capacity_unit, reason="demand_unit_mismatch"))
    return issues


def assert_consistency(db: Session, assignment, **kwargs) -> None:
    issues = assignment_consistency(db, assignment, **kwargs)
    if issues:
        raise PlanLinkageConflict(issues[0])


def card_consistency(db: Session, card_id: int) -> list[ProductionDiagnostic]:
    from app.services.production_demand import load_card_demand_snapshot
    rows = list(db.scalars(select(CalendarAssignment).where(CalendarAssignment.technical_card_id == card_id)))
    if not any(row.stage_result_id is not None for row in rows):
        return [issue for row in rows for issue in assignment_consistency(db, row)]
    snapshot = load_card_demand_snapshot(db, card_id)
    return [issue for row in rows
            for issue in assignment_consistency(db, row, snapshot=snapshot)]


def protect_resource_edit(db: Session, resource_key: str, changes: dict) -> None:
    resource = db.get(CapacityResource, resource_key)
    if resource is None:
        return
    for allocation, assignment in db.execute(select(CalendarAllocation, CalendarAssignment).join(CalendarAssignment)
            .where(CalendarAllocation.resource_key == resource_key)):
        protected_fields = ("capacity_unit", "resource_type", "work_center_id", "production_stage_id")
        changed = [key for key in protected_fields if key in changes and changes[key] != getattr(resource, key)]
        if changed or changes.get("include_in_calendar_load") is False or changes.get("delete"):
            code = "calendar_allocation_unit_mismatch" if "capacity_unit" in changed else "calendar_allocation_resource_mismatch"
            raise PlanLinkageConflict(diagnostic(db, assignment, code, allocation=allocation, resource_key=resource_key,
                expected={key: getattr(resource, key) for key in changed}, actual={key: changes[key] for key in changed},
                reason="saved_allocations_protect_resource_identity"))


def protect_operation_links(db: Session, operation_id: int, removed_keys: set[str]) -> None:
    for allocation, assignment in db.execute(select(CalendarAllocation, CalendarAssignment).join(CalendarAssignment)
            .join(TechnicalCardStageResult, CalendarAssignment.stage_result_id == TechnicalCardStageResult.id)
            .where(TechnicalCardStageResult.tech_operation_id == operation_id, CalendarAllocation.resource_key.in_(removed_keys))):
        raise PlanLinkageConflict(diagnostic(db, assignment, "calendar_allocation_resource_mismatch", allocation=allocation,
            resource_key=allocation.resource_key, expected="retained operation/resource link", actual="requested unlink"))
