"""Read-only demand for one technical card. Does not place work or reserve capacity.

Adapters see one immutable snapshot. Dispatch uses calculation_mode and the
resource unit. Only the cutting adapter reads TechOperation.code, and only
the exact code manual-cut together with a stored cutting_method.
"""

from __future__ import annotations

import decimal
from dataclasses import dataclass
from decimal import Decimal

from sqlalchemy.orm import Session

from app.schemas.production_demand import (
    CardDemandRead,
    DemandIssueRead,
    ResourceDemandRead,
    StepDemandRead,
)
from app.services.production_demand_snapshot import CardDemandSnapshot, DemandStep, SewingSource, VolumeRow

DEMAND_CONTEXT = decimal.Context(prec=28)
HOURLY_UNITS = frozenset({"labor_hour", "machine_hour", "team_hour"})
SEWING_FORMULA = "sum_seconds_multiplicity_times_card_quantity_div_3600"


def decimal_string(value: Decimal) -> str:
    text = format(value, "f")
    if "." in text:
        text = text.rstrip("0").rstrip(".")
    return text or "0"


@dataclass(frozen=True)
class _Draft:
    amount: Decimal | None
    unit: str | None
    status: str
    source_type: str | None
    details: dict[str, object]


def read_technical_card_demand(
    db: Session, card_id: int, routing_stage_line_id: int | None = None
) -> CardDemandRead:
    from app.services.technical_cards import TechnicalCardNotFoundError

    snapshot = load_card_demand_snapshot(db, card_id)
    if snapshot is None:
        raise TechnicalCardNotFoundError("Technical card not found")
    result = calculate_demands(snapshot)
    if routing_stage_line_id is None:
        return result
    selected = [step for step in result.steps if step.routing_stage_line_id == routing_stage_line_id]
    if not selected:
        raise TechnicalCardNotFoundError("Шаг маршрута не найден на этой ТК")
    return result.model_copy(update={
        "steps": selected,
        "status": _aggregate_statuses([step.status for step in selected]),
        "issues": [],
    })


def load_card_demand_snapshot(db: Session, card_id: int) -> CardDemandSnapshot | None:
    from app.services.production_demand_snapshot import load_card_demand_snapshot as _load

    return _load(db, card_id)


def calculate_demands(snapshot: CardDemandSnapshot) -> CardDemandRead:
    if not snapshot.steps:
        issue = DemandIssueRead(
            reason_code="missing_route",
            technical_card_id=snapshot.technical_card_id,
        )
        return CardDemandRead(
            technical_card_id=snapshot.technical_card_id,
            status="missing_input",
            steps=[],
            issues=[issue],
        )
    steps = [calculate_step_demands(snapshot, step) for step in snapshot.steps]
    return CardDemandRead(
        technical_card_id=snapshot.technical_card_id,
        status=_aggregate_statuses([step.status for step in steps]),
        steps=steps,
        issues=[],
    )


def calculate_step_demands(snapshot: CardDemandSnapshot, step: DemandStep) -> StepDemandRead:
    with decimal.localcontext(DEMAND_CONTEXT):
        return _step_demands(snapshot, step)


def _step_demands(snapshot: CardDemandSnapshot, step: DemandStep) -> StepDemandRead:
    identity = dict(
        technical_card_id=snapshot.technical_card_id,
        routing_stage_line_id=step.routing_stage_line_id,
    )
    if snapshot.routing_template_id != step.routing_template_id or _stage_disagrees(step):
        return _blocked(snapshot, step, "route_snapshot_mismatch")
    if step.operation_id is None:
        return _blocked(snapshot, step, "missing_operation")
    if not step.resources:
        return _blocked(snapshot, step, "missing_resource_link")
    demands = [
        _resource_demand(snapshot, step, resource)
        for resource in sorted(step.resources, key=lambda row: row.resource_key)
    ]
    issues = [
        DemandIssueRead(
            reason_code=str(demand.details.get("reason_code")),
            operation_id=step.operation_id,
            resource_key=demand.resource_key,
            **identity,
        )
        for demand in demands
        if demand.status != "ready" and demand.status != "not_applicable" and demand.details.get("reason_code")
    ]
    return StepDemandRead(
        **identity,
        stage_order=step.stage_order,
        stage_label=step.stage_label,
        operation_id=step.operation_id,
        operation_name=step.operation_name,
        status=_aggregate_statuses([demand.status for demand in demands]),
        demands=demands,
        issues=issues,
    )


def _stage_disagrees(step: DemandStep) -> bool:
    return (
        step.operation_stage_id is not None
        and step.production_stage_id is not None
        and step.operation_stage_id != step.production_stage_id
    )


def _blocked(snapshot: CardDemandSnapshot, step: DemandStep, reason: str) -> StepDemandRead:
    issue = DemandIssueRead(
        reason_code=reason,
        technical_card_id=snapshot.technical_card_id,
        routing_stage_line_id=step.routing_stage_line_id,
        operation_id=step.operation_id,
    )
    return StepDemandRead(
        technical_card_id=snapshot.technical_card_id,
        routing_stage_line_id=step.routing_stage_line_id,
        stage_order=step.stage_order,
        stage_label=step.stage_label,
        operation_id=step.operation_id,
        operation_name=step.operation_name,
        status="missing_input",
        demands=[],
        issues=[issue],
    )


def _resource_demand(snapshot: CardDemandSnapshot, step: DemandStep, resource) -> ResourceDemandRead:
    draft = _draft_for_resource(snapshot, step, resource)
    if draft.status == "ready":
        draft = _match_unit(draft, resource.capacity_unit)
    return ResourceDemandRead(
        technical_card_id=snapshot.technical_card_id,
        routing_stage_line_id=step.routing_stage_line_id,
        operation_id=step.operation_id,
        resource_key=resource.resource_key,
        amount=None if draft.amount is None else decimal_string(draft.amount),
        unit=draft.unit,
        status=draft.status,
        source_type=draft.source_type,
        details=draft.details,
    )


def _draft_for_resource(snapshot: CardDemandSnapshot, step: DemandStep, resource) -> _Draft:
    if resource.calculation_mode == "milestone" or resource.resource_type == "milestone":
        return _Draft(None, None, "not_applicable", "milestone", _details("milestone", None))
    if not resource.include_in_calendar_load:
        return _Draft(None, None, "not_applicable", None, _details("excluded", "resource_excluded"))
    mode = resource.calculation_mode
    unit = resource.capacity_unit
    if mode == "sewing_norm":
        return _match_unit(_sewing(snapshot, step), unit)
    if mode == "rate" and unit == "item":
        return _item_quantity(snapshot.quantity, "item_throughput")
    if mode == "rate" and unit == "linear_meter":
        return _linear_meters(step, snapshot.volumes)
    if mode == "rate" and unit in HOURLY_UNITS:
        return _hourly_rate_rejected(snapshot, step)
    if mode == "explicit_hours":
        return _manual_hours(unit)
    if mode == "cutting_methods":
        return _cutting_method(snapshot, step, resource)
    if mode == "team_rate":
        return _item_quantity(snapshot.quantity, "team_throughput")
    return _Draft(None, None, "missing_input", None, _details("unsupported", "unsupported_calculation_mode"))


def _hourly_rate_rejected(snapshot: CardDemandSnapshot, step: DemandStep) -> _Draft:
    if step.operation_volume_unit == "pieces":
        return _item_quantity(snapshot.quantity, "item_throughput")
    return _linear_meters(step, snapshot.volumes)


def _manual_hours(unit: str | None) -> _Draft:
    reason = "missing_operator_norm" if unit == "labor_hour" else "missing_fixed_norm"
    hourly = unit if unit in HOURLY_UNITS else None
    return _Draft(None, hourly, "manual_required", "manual", _details("manual", reason, expected_unit=unit))


_CUTTING_RATE_KEYS = {
    "manual_single": "manual_single_items_per_person_hour",
    "manual_lay": "manual_lay_items_per_person_hour",
}


def _cutting_method(snapshot: CardDemandSnapshot, step: DemandStep, resource) -> _Draft:
    """manual-cut uses the stored method's rate. Other operations stay unresolved."""
    unit = resource.capacity_unit if resource.capacity_unit in HOURLY_UNITS else "item"
    if step.operation_code != "manual-cut":
        return _Draft(None, unit, "manual_required", "manual", _details("cutting", "missing_cutting_mode"))
    related = [row for row in snapshot.volumes if row.tech_operation_id == step.operation_id]
    matched = [
        row for row in related
        if row.stage_order == step.stage_order and row.production_stage_id == step.production_stage_id
    ]
    if not matched and related:
        return _Draft(
            None, unit, "missing_input", "manual",
            _details("cutting", "route_snapshot_mismatch", expected_unit="item"),
        )
    if len(matched) != 1 or matched[0].cutting_method not in _CUTTING_RATE_KEYS:
        return _Draft(None, unit, "manual_required", "manual", _details("cutting", "missing_cutting_mode"))
    method = matched[0].cutting_method
    rate_key = _CUTTING_RATE_KEYS[method]
    rate = _positive_rate(resource.norm_rates, rate_key)
    if rate is None:
        return _Draft(
            None, "item", "missing_input", "manual",
            _details("cutting", "missing_cutting_rate", cutting_method=method, rate_key=rate_key, expected_unit="item"),
        )
    draft = _item_quantity(snapshot.quantity, "cutting")
    if draft.status != "ready":
        return draft
    details = dict(draft.details)
    details.update({
        "cutting_method": method,
        "rate_key": rate_key,
        "items_per_person_hour": decimal_string(rate),
        "formula_id": "technical_card_quantity_for_selected_cutting_method",
    })
    return _Draft(draft.amount, draft.unit, draft.status, draft.source_type, details)


def _positive_rate(rates: dict | None, key: str) -> Decimal | None:
    if not isinstance(rates, dict) or key not in rates or rates[key] is None:
        return None
    try:
        value = Decimal(str(rates[key]))
    except Exception:
        return None
    if not value.is_finite() or value <= 0:
        return None
    return value


def _item_quantity(quantity: Decimal, adapter: str) -> _Draft:
    source = "technical_card_quantity"
    if not quantity.is_finite() or quantity <= 0:
        return _Draft(None, "item", "missing_input", source, _details(adapter, "invalid_quantity", expected_unit="item"))
    return _Draft(
        quantity,
        "item",
        "ready",
        source,
        _details(adapter, None, expected_unit="item", quantity=decimal_string(quantity), formula_id="technical_card_quantity"),
    )


def _linear_meters(step: DemandStep, volumes: tuple[VolumeRow, ...]) -> _Draft:
    related = [row for row in volumes if row.tech_operation_id == step.operation_id]
    matched = [
        row for row in related
        if row.stage_order == step.stage_order and row.production_stage_id == step.production_stage_id
    ]
    if not matched and related:
        return _Draft(None, "linear_meter", "missing_input", "technical_card_linear_meters", _details("linear_meter_throughput", "route_snapshot_mismatch", expected_unit="linear_meter"))
    meters = [row for row in matched if row.volume_unit == "linear_meters"]
    if len(meters) > 1:
        return _Draft(None, "linear_meter", "missing_input", "technical_card_linear_meters", _details("linear_meter_throughput", "ambiguous_operation_volume", expected_unit="linear_meter", operation_line_ids=[row.id for row in meters]))
    if len(matched) == 1 and matched[0].volume_unit != "linear_meters":
        return _Draft(None, "linear_meter", "missing_input", "technical_card_linear_meters", _details("linear_meter_throughput", "route_snapshot_mismatch", expected_unit="linear_meter", operation_line_id=matched[0].id))
    if len(meters) != 1 or meters[0].volume <= 0 or not meters[0].volume.is_finite():
        return _Draft(None, "linear_meter", "missing_input", "technical_card_linear_meters", _details("linear_meter_throughput", "missing_linear_meters", expected_unit="linear_meter"))
    row = meters[0]
    return _Draft(
        row.volume,
        "linear_meter",
        "ready",
        "technical_card_linear_meters",
        _details(
            "linear_meter_throughput",
            None,
            expected_unit="linear_meter",
            formula_id="technical_card_operation_volume",
            volume=decimal_string(row.volume),
            operation_line_id=row.id,
        ),
    )


def _sewing(snapshot: CardDemandSnapshot, step: DemandStep) -> _Draft:
    scoped = [
        row for row in snapshot.applied_sewing
        if row.stage_order == step.stage_order and row.production_stage_id == step.production_stage_id
    ]
    base = _details("sewing_time", None, expected_unit="labor_hour", formula_id=SEWING_FORMULA)
    if snapshot.sewing_unverified or (not scoped and snapshot.applied_sewing):
        return _Draft(None, "labor_hour", "missing_input", None, {**base, "reason_code": "sewing_norm_unverified"})
    if not scoped:
        return _Draft(None, "labor_hour", "missing_input", None, {**base, "reason_code": "missing_sewing_norm"})
    if not snapshot.sewing_sources:
        return _Draft(None, "labor_hour", "missing_input", None, {**base, "reason_code": "sewing_norm_unverified"})
    used: set[int] = set()
    seconds = Decimal("0")
    card_ids: list[int] = []
    source_ids: list[int] = []
    for row in scoped:
        if row.sewing_operation_id is not None:
            matches = [source for source in snapshot.sewing_sources if source.sewing_operation_id == row.sewing_operation_id]
        else:
            matches = [source for source in snapshot.sewing_sources if source.operation_name == row.operation_name]
        if len(matches) != 1 or matches[0].id in used:
            return _Draft(None, "labor_hour", "missing_input", "sewing_operation_times", {**base, "reason_code": "sewing_norm_unverified", "card_operation_line_ids": [row.id]})
        source = matches[0]
        if source.duration_seconds <= 0 or source.quantity_per_item < 1:
            return _Draft(None, "labor_hour", "missing_input", "sewing_operation_times", {**base, "reason_code": "missing_sewing_norm", "card_operation_line_ids": [row.id], "norm_line_ids": [source.id]})
        used.add(source.id)
        seconds += Decimal(source.duration_seconds) * Decimal(source.quantity_per_item)
        card_ids.append(row.id)
        source_ids.append(source.id)
    if not snapshot.quantity.is_finite() or snapshot.quantity <= 0:
        return _Draft(None, "labor_hour", "missing_input", "sewing_operation_times", {**base, "reason_code": "invalid_quantity"})
    amount = seconds * snapshot.quantity / Decimal(3600)
    table = snapshot.sewing_sources[0].norm_table
    return _Draft(
        amount,
        "labor_hour",
        "ready",
        "sewing_operation_times",
        {
            **base,
            "quantity": decimal_string(snapshot.quantity),
            "seconds_per_item": decimal_string(seconds),
            "card_operation_line_ids": card_ids,
            "norm_line_ids": source_ids,
            "norm_table": table,
        },
    )


def _match_unit(draft: _Draft, expected: str | None) -> _Draft:
    if draft.status != "ready" or draft.unit == expected:
        return draft
    details = dict(draft.details)
    details["reason_code"] = "capacity_unit_mismatch"
    details["expected_unit"] = expected
    details["candidate_amount"] = None if draft.amount is None else decimal_string(draft.amount)
    details["candidate_unit"] = draft.unit
    return _Draft(None, draft.unit, "missing_input", draft.source_type, details)


def _details(adapter: str, reason: str | None, **extra: object) -> dict[str, object]:
    payload: dict[str, object] = {"adapter": adapter, "reason_code": reason}
    payload.update(extra)
    return payload


def _aggregate_statuses(statuses: list[str]) -> str:
    if not statuses:
        return "missing_input"
    if "missing_input" in statuses:
        return "missing_input"
    if "manual_required" in statuses:
        return "manual_required"
    if all(status == "not_applicable" for status in statuses):
        return "not_applicable"
    if all(status in {"ready", "not_applicable"} for status in statuses):
        return "ready"
    return "missing_input"
