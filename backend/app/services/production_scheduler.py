"""PC-04.3A: explicit, atomic, forward placement of one standalone card."""
from datetime import date, datetime, timedelta, timezone
from dataclasses import replace
from decimal import Decimal, ROUND_CEILING, ROUND_FLOOR, localcontext

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.calendar_allocation import CalendarAllocation
from app.models.calendar_assignment import CalendarAssignment
from app.models.production_capacity import CapacityResource, ProductionCapacityException
from app.models.technical_card import TechnicalCard
from app.repositories import production_scheduler as repo
from app.schemas.production_schedule import ScheduleDeviation, ScheduleRead, ScheduledAllocation, ScheduledStep
from app.services.production_demand import calculate_step_demands, load_card_demand_snapshot
from app.services.scheduler_horizon import SCHEDULER_HORIZON_DAYS
from app.services.technical_card_planning import planning_start_on, platform_timezone_name
from app.services.technical_cards import TechnicalCardConflictError, TechnicalCardNotFoundError

QUANTUM = Decimal("0.0001")
MAX_AMOUNT = Decimal("9999999999.9999")


def _value(value) -> str:
    return value.value if hasattr(value, "value") else str(value)


def priority_sort_key(card) -> tuple:
    """Compatible future batch ordering; this command schedules only one card."""
    return (card.priority is None, card.priority or 0, card.shipping_date or date.max,
            card.planning_start_date or date.max, card.created_at, card.id)


class _Blocked(Exception):
    def __init__(self, code, reason, line=None, key=None):
        self.deviation = ScheduleDeviation(code=code, reason=reason, routing_stage_line_id=line, resource_key=key)


def _fail(code, reason, step=None, key=None):
    raise _Blocked(code, reason, None if step is None else step.routing_stage_line_id, key)


def _positive(value) -> Decimal | None:
    if value is None:
        return None
    amount = Decimal(str(value))
    return amount if amount.is_finite() and amount > 0 else None


def _cut_rate(resource: CapacityResource, demand) -> Decimal | None:
    if resource.calculation_mode != "cutting_methods":
        return None
    return _positive(demand.details.get("items_per_person_hour"))


def _capacity(resource: CapacityResource, day: date, override: ProductionCapacityException | None, rate: Decimal | None) -> Decimal | None:
    if override is not None:
        return Decimal(0) if override.unavailable else override.capacity
    if day.weekday() not in resource.working_days:
        return Decimal(0)
    if resource.hours_per_day is None or resource.shifts_per_day is None or resource.efficiency is None:
        return None
    hours = resource.hours_per_day * resource.shifts_per_day * resource.efficiency
    if resource.calculation_mode == "team_rate" and resource.resource_count != 1:
        return None  # One team is the throughput resource, not two multiplied employees.
    count = Decimal(1) if resource.resource_type == "machine" else resource.resource_count
    if count is None:
        return None
    if resource.capacity_unit in {"item", "linear_meter"}:
        productivity = rate if resource.calculation_mode == "cutting_methods" else _positive(resource.base_rate)
        return None if productivity is None else hours * count * productivity
    if resource.capacity_unit == "team_hour":
        return hours if count else Decimal(0)
    return hours * count


def _protected(row: CalendarAssignment, fact_orders: set[int], step_by_id: dict, today: date,
               *, allow_overdue: bool = False) -> bool:
    step = step_by_id.get(row.routing_stage_line_id)
    return (row.manual_lock or row.planning_mode != "auto" or (row.planned_date < today and not allow_overdue)
            or (step is not None and step.stage_order in fact_orders))


def _place_step(step, own_demands, resources, overrides, occupied, rates, earliest, end):
    totals = {d.resource_key: Decimal(d.amount).quantize(QUANTUM, rounding=ROUND_CEILING) for d in own_demands}
    remaining, daily = dict(totals), []
    day = earliest
    while any(value > 0 for value in remaining.values()) and day <= end:
        available = {}
        for demand in own_demands:
            key, resource = demand.resource_key, resources[demand.resource_key]
            token, rate = (key, day), _cut_rate(resource, demand)
            capacity = _capacity(resource, day, overrides.get(token), rate)
            if capacity is None:
                _fail("capacity_missing", "resource_capacity_not_configured", step, key)
            if rate is not None and rates.get(token, {rate}) != {rate}:
                available[key] = Decimal(0)  # Conservative one cutting method per shared day.
            else:
                available[key] = max(Decimal(0), capacity - occupied.get(token, Decimal(0))).quantize(QUANTUM, rounding=ROUND_FLOOR)
        active = [key for key, value in remaining.items() if value > 0]
        fraction = min(Decimal(1), *(available[key] / remaining[key] for key in active))
        amounts = {key: min(remaining[key], available[key]) if fraction == 1 else (remaining[key] * fraction).quantize(QUANTUM, rounding=ROUND_FLOOR) for key in active}
        if amounts and all(amount > 0 for amount in amounts.values()):
            for demand in own_demands:
                key = demand.resource_key
                resource = resources[key]
                if key not in amounts:
                    continue
                amount = amounts[key]
                daily.append(ScheduledAllocation(resource_key=key, date=day, allocated_amount=amount, capacity_unit=demand.unit, work_center_id=resource.work_center_id if resource.resource_type == "machine" else None))
                remaining[key] -= amount
                occupied[(key, day)] = occupied.get((key, day), Decimal(0)) + amount
                rate = _cut_rate(resources[key], demand)
                if rate is not None:
                    rates.setdefault((key, day), set()).add(rate)
        day += timedelta(days=1)
    if any(value > 0 for value in remaining.values()) or earliest > end:
        _fail("no_available_capacity", "120_day_horizon_exhausted", step)
    return ScheduledStep(routing_stage_line_id=step.routing_stage_line_id, snapshot_node_id=step.snapshot_node_id,
                            production_stage_id=step.production_stage_id,
                            planned_start_date=min(a.date for a in daily) if daily else earliest,
                            planned_end_date=max(a.date for a in daily) if daily else earliest, allocations=daily)


def _dependency_order(steps):
    """Place each snapshot operation after its own predecessors. A chain stays sequential."""
    pending = list(steps)
    ordered = []
    finished = set()
    while pending:
        ready = [step for step in pending if set(step.predecessor_ids) <= finished]
        if not ready:
            return steps
        step = min(ready, key=lambda item: (item.stage_order, item.routing_stage_line_id))
        ordered.append(step)
        finished.add(step.routing_stage_line_id)
        pending.remove(step)
    return ordered


def _demand_options(demands, resources):
    machines = [d for d in demands if resources[d.resource_key].resource_type == "machine"]
    mandatory = [d for d in demands if resources[d.resource_key].resource_type != "machine"]
    return [mandatory + [machine] for machine in machines] if machines else [mandatory]


def eligible_machine_keys(resource_keys, resources, centers, production_stage_id):
    """Shared existing machine identity rule; readiness must use the same candidates."""
    return {key for key in resource_keys
            if (row := resources.get(key)) is not None and row.include_in_calendar_load
            and (center := centers.get(row.work_center_id)) is not None and center.is_active
            and center.production_stage_id == row.production_stage_id == production_stage_id}


def _build(card: TechnicalCard, snapshot, data: dict, today: date) -> tuple[ScheduleRead, set[int]]:
    start = max(today, card.planning_start_date or today)
    end = start + timedelta(days=SCHEDULER_HORIZON_DAYS - 1)
    result = ScheduleRead(technical_card_id=card.id, status="blocked", planning_from=start, horizon_end=end)
    try:
        if data.get("linkage_issues"):
            _fail("locked_assignment_conflict", data["linkage_issues"][0].code)
        if data.get("route_review_issue"):
            _fail("readiness_not_complete", "route_requires_review_before_planning")
        if snapshot.unresolved_variant_groups:
            _fail("variant_not_selected", ",".join(snapshot.unresolved_variant_groups))
        if card.plan_locked:
            _fail("locked_assignment_conflict", "plan_locked")
        if card.order_group_id is None or card.sales_order_id is not None or _value(card.status) not in {"draft", "in_progress"}:
            _fail("readiness_not_complete", "standalone_active_card_required")
        if _positive(card.quantity) is None or card.planning_start_date is None or card.shipping_date is None:
            _fail("readiness_not_complete", "quantity_planning_start_shipping_required")
        if data["route"] is None or not data["route"].is_active:
            _fail("readiness_not_complete", "active_route_required")
        stages = {stage.id: stage for stage in data["stages"]}
        operations = {operation.id: operation for operation in data["operations"]}
        steps = [step for step in snapshot.steps if step.production_stage_id not in stages
                 or stages[step.production_stage_id].code != "launch_preparation"]
        if not steps:
            _fail("readiness_not_complete", "production_route_required")
        demands = {}
        resources = {row.resource_key: row for row in data["resources"]}
        centers = {center.id: center for center in data["centers"]}
        for step in steps:
            stage, operation = stages.get(step.production_stage_id), operations.get(step.operation_id)
            if stage is None or not stage.is_active or operation is None or not operation.is_active:
                _fail("readiness_not_complete", "active_step_operation_required", step)
            machine_views = [view for view in step.resources if view.resource_type == "machine"]
            if machine_views:
                eligible = eligible_machine_keys((view.resource_key for view in machine_views), resources, centers, step.production_stage_id)
                if not eligible:
                    _fail("capacity_missing", "no_compatible_active_machine", step)
                step = replace(step, resources=tuple(view for view in step.resources
                               if view.resource_type != "machine" or view.resource_key in eligible))
            computed = calculate_step_demands(snapshot, step)
            for issue in computed.issues:
                code = ("capacity_unit_mismatch" if issue.reason_code == "capacity_unit_mismatch"
                        else "capacity_missing" if issue.reason_code == "missing_resource_link"
                        else "manual_required" if computed.status == "manual_required" else "demand_calculation_missing")
                _fail(code, issue.reason_code, step, issue.resource_key)
            if computed.status not in {"ready", "not_applicable"}:
                _fail("demand_calculation_missing", computed.status, step)
            demands[step.routing_stage_line_id] = [d for d in computed.demands if d.status == "ready"]
            for demand in demands[step.routing_stage_line_id]:
                row = resources.get(demand.resource_key)
                if row is None or not row.include_in_calendar_load:
                    _fail("capacity_missing", "resource_unavailable", step, demand.resource_key)
                if row.capacity_unit != demand.unit:
                    _fail("capacity_unit_mismatch", "demand_resource_unit", step, demand.resource_key)
                stage_binding = stages.get(row.production_stage_id)
                if stage_binding is None or not stage_binding.is_active:
                    _fail("capacity_missing", "resource_stage_inactive", step, demand.resource_key)
                if row.resource_type == "machine":
                    center = centers.get(row.work_center_id)
                    if center is None or not center.is_active or center.production_stage_id != row.production_stage_id:
                        _fail("capacity_missing", "machine_binding_missing", step, demand.resource_key)
                amount = Decimal(demand.amount).quantize(QUANTUM, rounding=ROUND_CEILING)
                if amount <= 0 or amount > MAX_AMOUNT:
                    _fail("demand_calculation_missing", "allocation_precision_range", step, demand.resource_key)
        step_by_id = {step.routing_stage_line_id: step for step in steps}
        fact_orders = {fact.stage_order for fact in data["facts"] if _value(fact.status) in {"in_progress", "completed"}}
        for fact in data["facts"]:
            matching = [step for step in steps if step.stage_order == fact.stage_order]
            if fact.stage_order in fact_orders and matching and matching[0].production_stage_id != fact.production_stage_id:
                _fail("locked_assignment_conflict", "fact_route_stage_mismatch", matching[0])
        replace_ids, anchors = set(), {}
        for row in data["own"]:
            if row.routing_stage_line_id is None:
                if stages.get(row.production_stage_id) is None or stages[row.production_stage_id].code != "launch_preparation":
                    _fail("locked_assignment_conflict", "unmapped_production_assignment")
                continue  # Preserve the existing entry marker, including its note/position.
            scoped_out = (data.get("replan_node_ids") is not None
                          and row.stage_result_id not in data["replan_node_ids"])
            allow_overdue = row.stage_result_id in data.get('editable_overdue_node_ids', set())
            if _protected(row, fact_orders, step_by_id, today, allow_overdue=allow_overdue) or scoped_out:
                if row.routing_stage_line_id not in step_by_id:
                    _fail("locked_assignment_conflict", "protected_foreign_route_step")
                if row.id in data.get("stale_assignment_ids", set()):
                    _fail("locked_assignment_conflict", "calendar_plan_stale_after_demand_change")
                anchors[row.routing_stage_line_id] = row
            else:
                replace_ids.add(row.id)
        for step in steps:
            if step.stage_order in fact_orders and step.routing_stage_line_id not in anchors:
                _fail("locked_assignment_conflict", "started_step_without_saved_plan", step)
        occupied, rates = {}, {}
        steps = _dependency_order(steps)
        allocations_by_assignment = {}
        for allocation, owner in data["allocations"]:
            if owner.id in replace_ids:
                continue
            if owner.technical_card_id != card.id and not start <= allocation.date <= end:
                continue
            row = resources[allocation.resource_key]
            if allocation.capacity_unit != row.capacity_unit:
                _fail("capacity_unit_mismatch", "existing_allocation_unit", key=row.resource_key)
            token = (row.resource_key, allocation.date)
            occupied[token] = occupied.get(token, Decimal(0)) + allocation.allocated_amount
            allocations_by_assignment.setdefault(owner.id, []).append(allocation)
            if row.calculation_mode == "cutting_methods":
                # Method is card data, not a guessed resource name/rate.
                # All route identities needed here were captured by the repository.
                identity = data["snapshot_nodes"].get(owner.stage_result_id) if owner.stage_result_id is not None else None
                if identity is None:
                    # Unmapped legacy assignment only. Mapped plans never reread the live template line.
                    identity = data["allocation_lines"].get(owner.routing_stage_line_id)
                matched = [volume for volume in data["volumes"] if identity is not None
                           and volume.technical_card_id == owner.technical_card_id
                           and volume.tech_operation_id == identity.tech_operation_id
                           and volume.stage_order == identity.stage_order
                           and volume.production_stage_id == identity.production_stage_id]
                mapping = {"manual_single": "manual_single_items_per_person_hour", "manual_lay": "manual_lay_items_per_person_hour"}
                method = matched[0].cutting_method if len(matched) == 1 else None
                rate = _positive((row.norm_rates or {}).get(mapping.get(method)))
                if rate is None:
                    _fail("capacity_missing", "existing_cutting_method_unverified", key=row.resource_key)
                rates.setdefault(token, set()).add(rate)
        overrides = {(row.resource_key, row.date): row for row in data["exceptions"]}
        finished = {}
        for step in steps:
            predecessor_ends = [finished[item] for item in step.predecessor_ids if item in finished]
            earliest = max([start, *predecessor_ends]) if predecessor_ends else start
            # Optional server-side manual date constraint; all placement, daily
            # capacity and protected-anchor validation remain in this engine.
            earliest = max(earliest, data.get('not_before_by_node', {}).get(step.snapshot_node_id, earliest))
            if (data.get("replan_node_ids") is not None and step.snapshot_node_id not in data["replan_node_ids"]
                    and step.routing_stage_line_id not in anchors):
                _fail("locked_assignment_conflict", "queue_scope_unplanned_predecessor", step)
            own_demands = demands[step.routing_stage_line_id]
            totals = {d.resource_key: Decimal(d.amount).quantize(QUANTUM, rounding=ROUND_CEILING) for d in own_demands}
            if step.routing_stage_line_id in anchors:
                row = anchors[step.routing_stage_line_id]
                saved = allocations_by_assignment.get(row.id, [])
                machine_demands = [d for d in own_demands if resources[d.resource_key].resource_type == "machine"]
                if machine_demands:
                    selected = {a.resource_key for a in saved if resources[a.resource_key].resource_type == "machine"}
                    if len(selected) != 1 or not selected <= {d.resource_key for d in machine_demands}:
                        _fail("locked_assignment_conflict", "anchor_machine_selection_mismatch", step)
                    own_demands = [d for d in own_demands if resources[d.resource_key].resource_type != "machine" or d.resource_key in selected]
                    totals = {d.resource_key: Decimal(d.amount).quantize(QUANTUM, rounding=ROUND_CEILING) for d in own_demands}
                sums = {}
                for allocation in saved:
                    sums[allocation.resource_key] = sums.get(allocation.resource_key, Decimal(0)) + allocation.allocated_amount
                    if allocation.date < row.planned_date or allocation.date > row.planned_end_date:
                        _fail("locked_assignment_conflict", "anchor_span_mismatch", step)
                if sums != totals or row.production_stage_id != step.production_stage_id:
                    _fail("locked_assignment_conflict", "anchor_demand_mismatch", step)
                if row.planned_date >= today and row.planned_date < earliest:
                    _fail("locked_assignment_conflict", "anchor_predecessor_conflict", step)
                if saved and (min(a.date for a in saved) != row.planned_date or max(a.date for a in saved) != row.planned_end_date):
                    _fail("locked_assignment_conflict", "anchor_span_mismatch", step)
                for demand in own_demands:
                    resource = resources[demand.resource_key]
                    for allocation in saved:
                        if allocation.resource_key != demand.resource_key or allocation.date < today:
                            continue
                        token = (resource.resource_key, allocation.date)
                        rate = _cut_rate(resource, demand)
                        if rate is not None and rates.get(token, {rate}) != {rate}:
                            _fail("locked_assignment_conflict", "anchor_cutting_method_conflict", step, resource.resource_key)
                        capacity = _capacity(resource, allocation.date, overrides.get(token), rate)
                        if capacity is None or occupied[token] > capacity:
                            _fail("locked_assignment_conflict", "anchor_capacity_conflict", step, resource.resource_key)
                planned = ScheduledStep(routing_stage_line_id=step.routing_stage_line_id, snapshot_node_id=step.snapshot_node_id,
                                        production_stage_id=step.production_stage_id,
                                        planned_start_date=row.planned_date, planned_end_date=row.planned_end_date,
                                        assignment_id=row.id, preserved=True,
                                        allocations=[ScheduledAllocation(resource_key=a.resource_key, date=a.date, allocated_amount=a.allocated_amount, capacity_unit=a.capacity_unit, work_center_id=resources[a.resource_key].work_center_id if resources[a.resource_key].resource_type == "machine" else None) for a in saved])
            else:
                trials, failures = [], []
                for option in _demand_options(own_demands, resources):
                    trial_occupied = dict(occupied)
                    trial_rates = {key: set(value) for key, value in rates.items()}
                    try:
                        trial = _place_step(step, option, resources, overrides, trial_occupied, trial_rates, earliest, end)
                        machine_keys = [d.resource_key for d in option if resources[d.resource_key].resource_type == "machine"]
                        trials.append((trial.planned_end_date, trial.planned_start_date, machine_keys, trial, trial_occupied, trial_rates))
                    except _Blocked as error:
                        failures.append(error)
                if not trials:
                    raise failures[0]
                _, _, _, planned, occupied, rates = min(trials, key=lambda trial: trial[:3])
            result.steps.append(planned)
            finished[step.routing_stage_line_id] = planned.planned_end_date  # Predecessor end included; occupancy prevents reuse.
        completion = max(step.planned_end_date for step in result.steps)
        buffer = (card.shipping_date - completion).days
        result.status, result.planned_completion_date = "planned", completion
        result.on_time, result.buffer_days, result.delay_days = buffer >= 0, buffer, max(0, -buffer)
        if buffer < 0:
            result.deviations.append(ScheduleDeviation(code="deadline_missed", reason="completion_after_shipping_date"))
        return result, replace_ids
    except _Blocked as error:
        result.steps = []
        result.deviations = [error.deviation]
        return result, set()


def delete_auto_plan(db: Session, ids: set[int]) -> None:
    if ids:
        from app.services.calendar_plan_linkage import retire_assignments
        rows = list(db.scalars(select(CalendarAssignment).where(CalendarAssignment.id.in_(ids))))
        retire_assignments(db, rows, reason="auto_plan_replaced", source="scheduler")


def persist_plan(db: Session, result: ScheduleRead, replace_ids: set[int]) -> None:
    """Write a complete plan without committing the caller's transaction."""
    from app.services.calendar_plan_lifecycle import assignment_event, assignment_state
    from app.services.calendar_plan_linkage import PlanLinkageConflict, assignment_issues, resource_mapping_valid, issue
    from app.models.technical_card import TechnicalCardStageResult
    for step in result.steps:
        candidate = db.get(CalendarAssignment, step.assignment_id) if step.preserved else CalendarAssignment(
            id=0, technical_card_id=result.technical_card_id, stage_result_id=step.snapshot_node_id,
            routing_stage_line_id=step.routing_stage_line_id, production_stage_id=step.production_stage_id)
        if candidate is None:
            raise TechnicalCardConflictError("Preserved assignment is missing")
        issues = assignment_issues(db, candidate)
        if issues:
            raise PlanLinkageConflict(issues[0])
        from app.services.calendar_allocation_consistency import assert_consistency
        assert_consistency(db, candidate, allocations=step.allocations,
                           start=step.planned_start_date, end=step.planned_end_date)
        node = db.get(TechnicalCardStageResult, candidate.stage_result_id)
        for allocation in step.allocations:
            if not resource_mapping_valid(db, db.get(CapacityResource, allocation.resource_key), step.production_stage_id, node.tech_operation_id):
                raise PlanLinkageConflict(issue(db, candidate, "calendar_assignment_snapshot_mismatch", reason="allocation_resource_workshop_mismatch",
                                               actual={"resource_key": allocation.resource_key}))
    replaced = {row.stage_result_id: assignment_state(row) | {"calendar_assignment_id": row.id}
                for row in db.scalars(select(CalendarAssignment).where(CalendarAssignment.id.in_(replace_ids)))}
    queue_positions = {row.stage_result_id: row.queue_position
                       for row in db.scalars(select(CalendarAssignment).where(CalendarAssignment.id.in_(replace_ids)))}
    delete_auto_plan(db, replace_ids)
    for step in result.steps:
        if step.preserved:
            continue
        tail = db.scalar(select(func.max(CalendarAssignment.position)).where(
            CalendarAssignment.production_stage_id == step.production_stage_id,
            CalendarAssignment.planned_date == step.planned_start_date))
        if tail is not None and tail >= 2147483647:
            raise TechnicalCardConflictError("Queue position limit reached")
        row = CalendarAssignment(technical_card_id=result.technical_card_id, routing_stage_line_id=step.routing_stage_line_id,
                                 stage_result_id=step.snapshot_node_id,
                                 production_stage_id=step.production_stage_id, planned_date=step.planned_start_date,
                                 planned_end_date=step.planned_end_date, planning_mode="auto", manual_lock=False,
                                 queue_position=queue_positions.get(step.snapshot_node_id),
                                 position=0 if tail is None else tail + 1)
        db.add(row)
        db.flush()
        step.assignment_id = row.id
        assignment_event(db, row, "assignment_created", reason="saved_schedule", source="scheduler",
                         demand_resource_keys=[a.resource_key for a in step.allocations])
        if step.snapshot_node_id in replaced:
            assignment_event(db, row, "assignment_replanned", previous_state=replaced[step.snapshot_node_id],
                             reason="auto_plan_replaced", source="scheduler")
        for allocation in step.allocations:
            db.add(CalendarAllocation(assignment_id=row.id, resource_key=allocation.resource_key,
                                      date=allocation.date, allocated_amount=allocation.allocated_amount,
                                      capacity_unit=allocation.capacity_unit))
    db.flush()  # The next card must see these allocations even under no_autoflush.


def schedule_card_in_transaction(db: Session, card_id: int, *, persist: bool, today: date | None = None) -> ScheduleRead:
    """Shared single/batch engine; caller owns locks and commit/rollback."""
    with db.no_autoflush, localcontext() as context:
        context.prec = 28
        card = repo.read_card(db, card_id, persist)
        if card is None:
            raise TechnicalCardNotFoundError("Technical card not found")
        current = today or planning_start_on(datetime.now(timezone.utc), platform_timezone_name(db))
        from pydantic import ValidationError
        try:
            snapshot = load_card_demand_snapshot(db, card.id)
        except ValidationError:
            from app.services.route_verification import route_review_issue
            review = route_review_issue(db, card)
            if review is None:
                raise
            return _build(card, None, {"route_review_issue": review}, current)[0]
        data = repo.read_inputs(db, card, snapshot, persist)
        # A preceding scheduler/settings writer may have committed while we waited for resources.
        snapshot = load_card_demand_snapshot(db, card.id)
        locked_keys = {row.resource_key for row in data["resources"]}
        if not {resource.resource_key for step in snapshot.steps for resource in step.resources} <= locked_keys:
            raise TechnicalCardConflictError("Resource links changed during scheduling; retry")
        result, replace_ids = _build(card, snapshot, data, current)
        if result.status == "planned" and persist:
            persist_plan(db, result, replace_ids)
        return result


def schedule_card(db: Session, card_id: int, *, persist: bool = True, today: date | None = None) -> ScheduleRead:
    """Owns commit/rollback. Dry-run reads without locks or writes."""
    try:
        if persist:
            repo.lock_scheduler(db)
        result = schedule_card_in_transaction(db, card_id, persist=persist, today=today)
        if result.status != "planned" or not persist:
            db.rollback()
            return result
        db.commit()
        result.persisted = True
        return result
    except IntegrityError as error:
        db.rollback()
        raise TechnicalCardConflictError("Schedule changed concurrently; retry the explicit command") from error
    except Exception:
        db.rollback()
        raise
