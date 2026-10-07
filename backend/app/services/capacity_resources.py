"""Canonical shared capacity resources; operations own links, never copies."""
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.production_capacity import CapacityResource, ProductionCapacityException
from app.models.production_stage import ProductionStage
from app.models.shop_routing import WorkCenter
from app.schemas.production_capacity import CapacityResourceDetail, CapacityResourceWrite
from app.services.production_calendar import CalendarError


def get_resources(db: Session, keys: list[str] | None = None, *, include_exceptions: bool = True) -> list[CapacityResourceDetail]:
    from app.services.production_capacity import _exception_read, _spec

    stmt = select(CapacityResource).order_by(CapacityResource.resource_key)
    exceptions_stmt = select(ProductionCapacityException).order_by(ProductionCapacityException.date)
    if keys is not None:
        stmt = stmt.where(CapacityResource.resource_key.in_(keys))
        exceptions_stmt = exceptions_stmt.where(ProductionCapacityException.resource_key.in_(keys))
    rows = list(db.scalars(stmt))
    exceptions = list(db.scalars(exceptions_stmt)) if include_exceptions else []
    result = []
    for row in rows:
        spec = _spec(row.resource_key, row)
        result.append(CapacityResourceDetail(
            key=row.resource_key, name=row.name or spec.name,
            production_stage_id=row.production_stage_id,
            work_center_id=row.work_center_id, resource_type=row.resource_type,
            capacity_unit=row.capacity_unit, base_rate=row.base_rate,
            resource_count=row.staff_count, hours_per_day=row.hours_per_day,
            shifts_per_day=row.shifts_per_day, efficiency=row.efficiency,
            working_days=row.working_days, include_in_calendar_load=row.include_in_calendar_load,
            calculation_mode=row.calculation_mode, note=row.note,
            exceptions=[_exception_read(item) for item in exceptions if item.resource_key == row.resource_key],
        ))
    return result


def save_resource(db: Session, key: str, payload: CapacityResourceWrite) -> CapacityResourceDetail:
    from app.services.production_capacity import RESOURCE_BY_KEY, _commit, legacy_defaults

    if not key or len(key) > 64 or key.strip() != key:
        raise CalendarError("Resource key must have 1-64 characters without surrounding whitespace")
    stage = db.get(ProductionStage, payload.production_stage_id)
    if stage is None or not stage.is_active:
        raise CalendarError("Select an active production stage")
    if payload.work_center_id is not None:
        center = db.get(WorkCenter, payload.work_center_id)
        if center is None or not center.is_active or center.production_stage_id != stage.id:
            raise CalendarError("Equipment must belong to the resource stage")
    legacy = RESOURCE_BY_KEY.get(key)
    if legacy is None and payload.calculation_mode not in {"explicit_hours", "rate", "milestone"}:
        raise CalendarError("Special norm rules are reserved for the existing sewing/cutting/team resources")
    if legacy is not None:
        defaults = legacy_defaults(legacy)
        if (stage.code != legacy.stage_code or payload.resource_type != defaults["resource_type"]
                or payload.capacity_unit != defaults["capacity_unit"]
                or payload.calculation_mode != defaults["calculation_mode"]):
            raise CalendarError("Legacy resource kind/unit/stage/calculation rule must remain compatible")
        if key == "cutters" and payload.resource_count is not None and payload.resource_count > 2:
            raise CalendarError("This shared pool supports at most two people")
        if key == "packing_team" and payload.resource_count not in (None, 1):
            raise CalendarError("Packing is one brigade: resource_count must be 1 and is not a headcount multiplier")
    row = db.get(CapacityResource, key)
    if row is None:
        row = CapacityResource(resource_key=key)
        db.add(row)
        if legacy:
            for name, value in legacy_defaults(legacy).items():
                setattr(row, name, value)
    values = payload.model_dump()
    values["staff_count"] = values.pop("resource_count")
    # machine count is implicit one WorkCenter; preserve the old staff_count=null contract.
    if payload.resource_type == "machine":
        values["staff_count"] = None
    for name, value in values.items():
        setattr(row, name, value)
    if row.base_rate is not None and legacy and legacy.rates and len(legacy.rates) == 1:
        row.norm_rates = {name: str(row.base_rate) for name in legacy.rates}
    _commit(db)
    return get_resources(db, [key])[0]


def delete_resource(db: Session, key: str) -> None:
    from app.models.production_capacity import TechOperationCapacityResource
    from app.services.production_capacity import _commit

    row = db.get(CapacityResource, key)
    if row is None:
        raise CalendarError("Capacity resource not found", 404)
    if db.scalar(select(TechOperationCapacityResource.resource_key).where(
            TechOperationCapacityResource.resource_key == key).limit(1)) is not None:
        raise CalendarError("Unlink the resource from operations before deleting it", 409)
    if db.scalar(select(ProductionCapacityException.resource_key).where(
            ProductionCapacityException.resource_key == key).limit(1)) is not None:
        raise CalendarError("Remove dated exceptions before deleting the resource", 409)
    db.delete(row)
    _commit(db)


def operation_resource_keys(db: Session, operation_id: int) -> list[str]:
    from app.models.tech_operation import TechOperation
    from app.models.production_capacity import TechOperationCapacityResource

    if db.get(TechOperation, operation_id) is None:
        raise CalendarError("Tech operation not found", 404)
    return list(db.scalars(select(TechOperationCapacityResource.resource_key).where(
        TechOperationCapacityResource.tech_operation_id == operation_id
    ).order_by(TechOperationCapacityResource.resource_key)))
