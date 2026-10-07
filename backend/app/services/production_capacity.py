"""PC-03.4A: persisted availability and warning-only, unit-specific load calculations."""
from collections import defaultdict
from dataclasses import dataclass, field, replace
from datetime import date
from decimal import Decimal

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.production_capacity import ProductionCapacityException, ProductionCapacitySettings
from app.repositories.production_capacity import read_capacity_data, sewing_norm_data
from app.schemas.production_capacity import (
    CapacityDemand, CapacityExceptionRead, CapacityExceptionUpdate, CapacityLoadRead,
    CapacityLoadRequest, CapacityNormRead, CapacityResourceRead, CapacitySettingsRead,
    CapacitySettingsUpdate, CapacityStageRead, CapacityWorkCenterRead,
)
from app.services.production_calendar import CalendarError, ENTRY_STAGE_CODE


@dataclass(frozen=True)
class ResourceSpec:
    key: str
    name: str
    stage_code: str
    kind: str
    unit: str
    norm_source: str = "manual"
    rates: dict[str, Decimal] = field(default_factory=dict)
    required_staff_count: int | None = None


RESOURCES = (
    ResourceSpec("designers", "Дизайнеры", "design", "pool", "person_hours"),
    ResourceSpec("print_operator", "Печатник / подготовка", "print", "pool", "person_hours"),
    *(ResourceSpec(f"plotter_{i}", f"Плоттер {i}", "print", "machine", "linear_meter", "confirmed_v0.1",
                  {"running_meters_per_hour": Decimal("15")}) for i in range(1, 5)),
    ResourceSpec("calender", "Каландр", "print", "machine", "linear_meter", "confirmed_v0.1", {"running_meters_per_hour": Decimal("60")}),
    ResourceSpec("calender_operator", "Оператор каландра", "print", "pool", "person_hours"),
    ResourceSpec("cutters", "Общий пул раскройщиков", "cutting", "pool", "item", "confirmed_v0.1",
                 {"manual_single_items_per_person_hour": Decimal("20"), "manual_lay_items_per_person_hour": Decimal("40")}),
    ResourceSpec("laser", "Лазер", "cutting", "machine", "item", "confirmed_v0.1", {"items_per_machine_hour": Decimal("100")}),
    ResourceSpec("laser_operator", "Оператор лазера", "cutting", "pool", "person_hours"),
    ResourceSpec("sewers", "Пошив", "sewing", "pool", "person_hours", "technical_card_assembly"),
    ResourceSpec("packing_team", "Бригада упаковки", "packaging", "team", "item", "confirmed_v0.1",
                 {"items_per_team_hour": Decimal("80")}, 1),
    ResourceSpec("procurement", "Закупка", ENTRY_STAGE_CODE, "milestone", "milestone", "milestone"),
)
RESOURCE_BY_KEY = {resource.key: resource for resource in RESOURCES}


def legacy_defaults(spec: ResourceSpec) -> dict:
    mode = ("milestone" if spec.kind == "milestone" else "sewing_norm" if spec.key == "sewers"
            else "cutting_methods" if spec.key == "cutters" else "team_rate" if spec.kind == "team"
            else "rate" if spec.rates else "explicit_hours")
    return dict(name=spec.name, resource_type="milestone" if spec.kind == "milestone" else "machine" if spec.kind == "machine" else "labor",
                capacity_unit={"person_hours": "labor_hour", "machine_hours": "machine_hour", "team_hours": "team_hour", "item": "item", "linear_meter": "linear_meter", "milestone": None}[spec.unit],
                base_rate=next(iter(spec.rates.values())) if len(spec.rates) == 1 else None,
                norm_rates={name: str(value) for name, value in spec.rates.items()}, calculation_mode=mode)


def _spec(key: str, row=None) -> ResourceSpec:
    spec = RESOURCE_BY_KEY.get(key)
    if spec is None and row is None:
        raise CalendarError("Ресурс мощности не найден", 404)
    if row is None:
        return spec
    rates = {name: Decimal(value) for name, value in (row.norm_rates or {}).items()}
    if spec is not None:
        return replace(spec, name=row.name or spec.name, rates=rates if row.norm_rates is not None else spec.rates,
                       norm_source=spec.norm_source if row.norm_rates is None or rates == spec.rates else "manual")
    return ResourceSpec(key, row.name or key, "", "milestone" if row.resource_type == "milestone" else "machine" if row.resource_type == "machine" else "pool",
                        {"labor_hour": "person_hours", "machine_hour": "machine_hours", "team_hour": "team_hours", None: "milestone"}.get(row.capacity_unit, row.capacity_unit),
                        rates=rates)


def _binding_valid(spec: ResourceSpec, row, stages_by_id: dict, centers_by_id: dict) -> bool:
    if row is None:
        return False
    stage = stages_by_id.get(row.production_stage_id)
    if stage is None or not stage.is_active or (spec.stage_code and stage.code != spec.stage_code):
        return False
    if spec.kind == "machine":
        center = centers_by_id.get(row.work_center_id)
        return center is not None and center.is_active and center.production_stage_id == stage.id
    return True


def _base_capacity(spec: ResourceSpec, row, valid: bool) -> Decimal | None:
    if not valid or row.hours_per_day is None or spec.kind == "milestone" or not row.include_in_calendar_load:
        return None
    hours = row.hours_per_day * row.shifts_per_day
    if row.efficiency != 1:
        hours *= row.efficiency
    if row.resource_type == "throughput":
        return None if row.staff_count is None or row.base_rate is None else hours * row.staff_count * row.base_rate
    if spec.kind == "machine":
        return hours
    if row.staff_count is None:
        return None
    if spec.kind == "team":
        if row.staff_count == 0:
            return Decimal("0")
        return hours if row.staff_count == spec.required_staff_count else None
    return hours * row.staff_count


def _exception_read(row: ProductionCapacityException) -> CapacityExceptionRead:
    return CapacityExceptionRead(date=row.date, capacity=row.capacity, unavailable=row.unavailable, note=row.note)


def _settings_read(data: tuple[list, list, list, list]) -> CapacitySettingsRead:
    stages, centers, settings, exceptions = data
    stages_by_id = {stage.id: stage for stage in stages}
    stages_by_code = {stage.code: stage for stage in stages}
    centers_by_id = {center.id: center for center in centers}
    by_key = {row.resource_key: row for row in settings}
    exception_map = defaultdict(list)
    for row in exceptions:
        exception_map[row.resource_key].append(_exception_read(row))
    resources = []
    for spec in RESOURCES:
        row = by_key.get(spec.key)
        spec = _spec(spec.key, row)
        stage = stages_by_id.get(row.production_stage_id) if row else stages_by_code.get(spec.stage_code)
        valid = _binding_valid(spec, row, stages_by_id, centers_by_id)
        editable = [] if spec.kind == "milestone" else [
            "work_center_id" if spec.kind == "machine" else "staff_count", "hours_per_day", "working_days", "note",
        ]
        resources.append(CapacityResourceRead(
            key=spec.key, name=spec.name, stage_code=spec.stage_code,
            production_stage_id=stage.id if stage else None, stage_name=stage.name if stage else None,
            stage_active=bool(stage and stage.is_active), kind=spec.kind, unit=spec.unit,
            configured=row is not None, work_center_id=row.work_center_id if row else None,
            staff_count=row.staff_count if row else None, hours_per_day=row.hours_per_day if row else None,
            working_days=row.working_days if row else [], note=row.note if row else None,
            base_capacity=_base_capacity(spec, row, valid), editable_fields=editable,
            norm=CapacityNormRead(source=spec.norm_source, rates=spec.rates, required_staff_count=spec.required_staff_count),
            exceptions=exception_map[spec.key],
        ))
    return CapacitySettingsRead(
        resources=resources,
        stages=[CapacityStageRead(id=row.id, name=row.name, code=row.code, is_active=row.is_active) for row in stages],
        work_centers=[CapacityWorkCenterRead(id=row.id, name=row.name, code=row.code,
                                            production_stage_id=row.production_stage_id, is_active=row.is_active) for row in centers],
    )


def get_settings(db: Session) -> CapacitySettingsRead:
    return _settings_read(read_capacity_data(db))


def _commit(db: Session) -> None:
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise CalendarError("Настройки уже изменены или оборудование привязано к другому ресурсу", 409) from error


def save_settings(db: Session, key: str, payload: CapacitySettingsUpdate) -> CapacityResourceRead:
    spec = _spec(key)
    if spec.kind == "milestone":
        raise CalendarError("Закупка — milestone без часовой мощности")
    data = read_capacity_data(db)
    stages, centers, settings, _ = data
    stage = next((row for row in stages if row.code == spec.stage_code and row.is_active), None)
    if stage is None:
        raise CalendarError("Настройте действующий участок в существующем справочнике")
    if spec.kind == "machine":
        center = next((row for row in centers if row.id == payload.work_center_id), None)
        if payload.staff_count is not None or center is None or not center.is_active or center.production_stage_id != stage.id:
            raise CalendarError("Для машины выберите действующее оборудование участка; staff_count=null")
    elif payload.work_center_id is not None:
        raise CalendarError("Общий пул/бригада не привязывается к оборудованию")
    if spec.key == "cutters" and payload.staff_count is not None and payload.staff_count > 2:
        raise CalendarError("Подтверждённый состав этого ресурса — максимум два человека")
    if spec.key == "packing_team" and payload.staff_count not in (None, 1):
        raise CalendarError("Бригада упаковки — один ресурс: resource_count=1, норма не умножается на численность")
    row = next((row for row in settings if row.resource_key == key), None)
    if row is None:
        row = ProductionCapacitySettings(resource_key=key)
        for name, value in legacy_defaults(spec).items():
            setattr(row, name, value)
        db.add(row)
    if payload.hours_per_day is not None and payload.hours_per_day * (row.shifts_per_day or 1) > 24:
        raise CalendarError("Total shift hours per day cannot exceed 24")
    row.production_stage_id = stage.id
    for name, value in payload.model_dump().items():
        setattr(row, name, value)
    _commit(db)
    return next(resource for resource in get_settings(db).resources if resource.key == key)


def save_exception(db: Session, key: str, day: date, payload: CapacityExceptionUpdate) -> CapacityExceptionRead:
    spec = _spec(key, db.get(ProductionCapacitySettings, key))
    if spec.kind == "milestone":
        raise CalendarError("Milestone не имеет исключений часовой мощности")
    if db.get(ProductionCapacitySettings, key) is None:
        raise CalendarError("Сначала сохраните настройки ресурса", 404)
    row = db.get(ProductionCapacityException, (key, day))
    if row is None:
        row = ProductionCapacityException(resource_key=key, date=day)
        db.add(row)
    for name, value in payload.model_dump().items():
        setattr(row, name, value)
    _commit(db)
    return _exception_read(row)


def remove_exception(db: Session, key: str, day: date) -> None:
    _spec(key, db.get(ProductionCapacitySettings, key))
    row = db.get(ProductionCapacityException, (key, day))
    if row is None:
        raise CalendarError("Исключение не найдено", 404)
    db.delete(row)
    _commit(db)


def _sewing_norms(db: Session, ids: set[int]) -> dict[int, tuple[Decimal | None, Decimal | None, str | None]]:
    cards, lines, snapshots, variants = sewing_norm_data(db, ids)
    lines_by_card, snapshots_by_item, variants_by_id = defaultdict(list), defaultdict(list), defaultdict(list)
    for line in lines:
        lines_by_card[line.technical_card_id].append(line)
    for snapshot in snapshots:
        snapshots_by_item[snapshot.order_item_id].append(snapshot)
    for line, model_id in variants:
        variants_by_id[line.assembly_variant_id].append((line, model_id))
    result = {}
    for card in cards:
        if card.sales_order_item_id is not None:
            source = snapshots_by_item[card.sales_order_item_id]
        else:
            rows = variants_by_id[card.assembly_variant_id]
            if rows and (card.product_model_id is None or any(model_id != card.product_model_id for _, model_id in rows)):
                result[card.id] = (None, card.quantity, "norm_unverified")
                continue
            source = [row for row, _ in rows]
        applied = lines_by_card[card.id]
        if not source or not applied:
            result[card.id] = (None, card.quantity, "norm_missing")
            continue
        seconds, used, reason = Decimal("0"), set(), None
        for line in applied:
            matches = [row for row in source if (
                row.sewing_operation_id == line.sewing_operation_id if line.sewing_operation_id is not None
                else row.operation_name == line.operation_name
            )]
            if len(matches) != 1 or matches[0].id in used:
                reason = "norm_unverified"
                break
            match = matches[0]
            if match.duration_seconds is None or match.duration_seconds <= 0 or match.quantity_per_item < 1:
                reason = "norm_missing"
                break
            used.add(match.id)
            seconds += Decimal(match.duration_seconds) * match.quantity_per_item
        result[card.id] = (None if reason else seconds, card.quantity, reason)
    return result


def estimate_hours(spec: ResourceSpec, demand: CapacityDemand, sewing_norms: dict) -> tuple[Decimal | None, str | None]:
    if spec.kind == "milestone":
        return None, "milestone"
    if spec.key == "sewers":
        if demand.hours is not None:
            raise CalendarError("Норма пошива берётся только из ТК/варианта сборки; ручные часы не допускаются")
        seconds, card_qty, reason = sewing_norms.get(demand.technical_card_id, (None, None, "norm_missing"))
        quantity = demand.quantity if demand.quantity is not None else card_qty
        if seconds is None or quantity is None:
            return None, reason or "norm_missing"
        return seconds * quantity / Decimal("3600"), None
    if demand.hours is not None:
        return demand.hours, None
    if "running_meters_per_hour" in spec.rates and demand.running_meters is not None:
        return demand.running_meters / spec.rates["running_meters_per_hour"], None
    if spec.key == "cutters" and demand.quantity is not None and demand.method is not None:
        return demand.quantity / spec.rates[f"{demand.method}_items_per_person_hour"], None
    if spec.key == "laser" and demand.quantity is not None:
        return demand.quantity / spec.rates["items_per_machine_hour"], None
    if spec.key == "packing_team" and demand.quantity is not None:
        return demand.quantity / spec.rates["items_per_team_hour"], None
    return None, "estimate_missing"


def calculate_load_state(capacity: Decimal | None, planned: Decimal, unknown_count: int,
                         unknown_reason: str | None = None) -> tuple[str, Decimal | None, str | None]:
    if unknown_count:
        return "unknown", None, unknown_reason or "norm_missing"
    if capacity is None:
        return "unknown", None, "capacity_unknown"
    if capacity == 0:
        return ("over" if planned > 0 else "unknown"), None, "zero_capacity"
    percent = planned / capacity * Decimal("100")
    return ("reserve" if percent < 80 else "near" if percent <= 100 else "over"), percent, None


def load_state(db: Session, payload: CapacityLoadRequest) -> CapacityLoadRead:
    data = read_capacity_data(db)
    stages, centers, settings, exceptions = data
    row = next((row for row in settings if row.resource_key == payload.resource_key), None)
    spec = _spec(payload.resource_key, row)
    if any(demand.unit != spec.unit for demand in payload.demands):
        raise CalendarError("Единицы нагрузки должны совпадать с единицей ресурса")
    valid = _binding_valid(spec, row, {item.id: item for item in stages}, {item.id: item for item in centers})
    capacity = None
    if valid and spec.kind != "milestone" and row.include_in_calendar_load:
        override = next((item for item in exceptions if item.resource_key == spec.key and item.date == payload.date), None)
        if override is not None:
            capacity = Decimal("0") if override.unavailable else override.capacity
        elif payload.date.weekday() not in row.working_days:
            capacity = Decimal("0")
        else:
            capacity = _base_capacity(spec, row, valid)
    norms = _sewing_norms(db, {item.technical_card_id for item in payload.demands if item.technical_card_id is not None}) if spec.key == "sewers" else {}
    planned, unknown_count, reason = Decimal("0"), 0, None
    for demand in payload.demands:
        if spec.key not in RESOURCE_BY_KEY and row is not None:
            if row.calculation_mode == "rate" and row.base_rate is not None:
                volume = demand.running_meters if row.capacity_unit == "linear_meter" or demand.running_meters is not None else demand.quantity
                hours = volume if row.resource_type == "throughput" else None if volume is None else volume / row.base_rate
                missing = None if hours is not None else "estimate_missing"
            elif row.calculation_mode == "explicit_hours":
                hours, missing = demand.hours, None if demand.hours is not None else "estimate_missing"
            else:
                hours, missing = None, "estimate_missing"
        else:
            hours, missing = estimate_hours(spec, demand, norms)
        if hours is None:
            unknown_count += 1
            reason = reason or missing
        else:
            planned += hours
    state, percent, missing = calculate_load_state(capacity, planned, unknown_count, reason)
    if spec.kind == "milestone":
        state, percent, missing = "unknown", None, "milestone"
    return CapacityLoadRead(resource_key=spec.key, date=payload.date, unit=spec.unit, capacity=capacity,
                            known_planned_hours=planned, unknown_demand_count=unknown_count,
                            load_percent=percent, state=state, reason=missing)
