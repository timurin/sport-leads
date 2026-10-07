"""Store a planned daily amount. Does not calculate demand or place work."""

from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.calendar_allocation import CalendarAllocation
from app.models.calendar_assignment import CalendarAssignment
from app.models.production_capacity import CapacityResource
from app.schemas.calendar_allocation import CalendarAllocationCreate, CalendarAllocationRead


class AllocationError(Exception):
    def __init__(self, message: str, status_code: int = 422):
        super().__init__(message)
        self.status_code = status_code


def add_allocation(db: Session, payload: CalendarAllocationCreate) -> CalendarAllocationRead:
    if db.get(CalendarAssignment, payload.assignment_id) is None:
        raise AllocationError("Назначение не найдено", 404)
    resource = db.get(CapacityResource, payload.resource_key)
    if resource is None:
        raise AllocationError("Ресурс мощности не найден", 404)
    if resource.capacity_unit is None:
        raise AllocationError("Этот ресурс не принимает дневное распределение")
    if payload.capacity_unit != resource.capacity_unit:
        raise AllocationError("Единица распределения должна совпадать с единицей ресурса")
    if payload.allocated_amount <= 0:
        raise AllocationError("Объём распределения должен быть больше нуля")
    row = CalendarAllocation(
        assignment_id=payload.assignment_id,
        resource_key=payload.resource_key,
        date=payload.date,
        allocated_amount=Decimal(payload.allocated_amount),
        capacity_unit=payload.capacity_unit,
    )
    db.add(row)
    try:
        db.flush()
    except IntegrityError as error:
        db.rollback()
        raise AllocationError(
            "Распределение на эту дату и ресурс уже есть", 409
        ) from error
    db.commit()
    db.refresh(row)
    return CalendarAllocationRead.model_validate(row)


def list_allocations(db: Session, assignment_id: int) -> list[CalendarAllocationRead]:
    rows = db.scalars(
        select(CalendarAllocation)
        .where(CalendarAllocation.assignment_id == assignment_id)
        .order_by(CalendarAllocation.date, CalendarAllocation.resource_key, CalendarAllocation.id)
    ).all()
    return [CalendarAllocationRead.model_validate(row) for row in rows]
