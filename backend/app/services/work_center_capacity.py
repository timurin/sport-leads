"""WorkCenter owns one adapter; speed/calendar are stored only on that adapter."""
from datetime import date

from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.models.calendar_allocation import CalendarAllocation
from app.models.calendar_assignment import CalendarAssignment
from app.models.production_capacity import CapacityResource
from app.models.shop_routing import WorkCenter
from app.schemas.production_capacity import CapacityResourceWrite
from app.schemas.work_center_capacity import WorkCenterCapacityWrite, WorkCenterAllocationRead, WorkCenterDayLoadRead
from app.services.capacity_resources import get_resources, save_resource
from app.services.production_calendar import CalendarError


def adapter(db: Session, center_id: int):
    center = db.get(WorkCenter, center_id)
    if center is None:
        raise CalendarError("WorkCenter not found", 404)
    row = db.scalar(select(CapacityResource).where(CapacityResource.work_center_id == center_id))
    return center, row


def read_capacity(db: Session, center_id: int):
    _, row = adapter(db, center_id)
    if row is None:
        raise CalendarError("WorkCenter capacity is not configured", 404)
    return get_resources(db, [row.resource_key])[0]


def save_capacity(db: Session, center_id: int, payload: WorkCenterCapacityWrite):
    from app.repositories.production_scheduler import lock_scheduler
    lock_scheduler(db)
    center, row = adapter(db, center_id)
    if center.production_stage_id is None:
        raise CalendarError("WorkCenter requires a production stage")
    # Preserve existing resource keys and their operation links/allocations.
    key = row.resource_key if row is not None else f"work_center_{center_id}"
    occupied_key = db.get(CapacityResource, key)
    if row is None and occupied_key is not None:
        raise CalendarError("Generated resource key is already used; configure a bound adapter explicitly", 409)
    values = payload.model_dump()
    return save_resource(db, key, CapacityResourceWrite(
        **values, resource_type="machine", work_center_id=center.id,
        production_stage_id=center.production_stage_id, resource_count=None,
        calculation_mode="explicit_hours" if payload.capacity_unit == "machine_hour" else "rate",
        name=center.name,
    ))


def allocations(db: Session, center_id: int, start: date, end: date):
    _, row = adapter(db, center_id)
    if end < start or (end - start).days >= 120:
        raise CalendarError("Allocation range must contain 1..120 dates")
    if row is None:
        return []
    return [WorkCenterAllocationRead(
        work_center_id=center_id, resource_key=row.resource_key, assignment_id=a.assignment_id,
        technical_card_id=card_id, date=a.date, allocated_amount=a.allocated_amount,
        capacity_unit=a.capacity_unit,
    ) for a, card_id in db.execute(select(CalendarAllocation, CalendarAssignment.technical_card_id)
        .join(CalendarAssignment).where(CalendarAllocation.resource_key == row.resource_key,
         CalendarAllocation.date.between(start, end)).order_by(CalendarAllocation.date, CalendarAllocation.assignment_id))]


def day_load(db: Session, center_id: int, day: date):
    from decimal import Decimal
    from app.models.production_capacity import ProductionCapacityException
    from app.models.production_stage import ProductionStage
    from app.services.production_scheduler import _capacity
    center, row = adapter(db, center_id)
    if row is None:
        raise CalendarError("WorkCenter capacity is not configured", 404)
    stage = db.get(ProductionStage, center.production_stage_id)
    valid = center.is_active and stage is not None and stage.is_active and row.include_in_calendar_load and row.production_stage_id == center.production_stage_id
    override = db.get(ProductionCapacityException, (row.resource_key, day))
    configured = _capacity(row, day, override, None) if valid else None
    mismatch = db.scalar(select(CalendarAllocation.id).where(CalendarAllocation.resource_key == row.resource_key,
                          CalendarAllocation.date == day, CalendarAllocation.capacity_unit != row.capacity_unit).limit(1))
    if mismatch is not None:
        raise CalendarError("Stored allocation unit differs from the equipment capacity", 409)
    amount = db.scalar(select(func.sum(CalendarAllocation.allocated_amount)).where(
        CalendarAllocation.resource_key == row.resource_key, CalendarAllocation.date == day)) or Decimal(0)
    return WorkCenterDayLoadRead(work_center_id=center_id, resource_key=row.resource_key, date=day,
        capacity_unit=row.capacity_unit, configured_capacity=configured, allocated=amount,
        remaining=None if configured is None else max(Decimal(0), configured - amount),
        utilization_percent=None if configured is None or configured == 0 else amount / configured * 100)
