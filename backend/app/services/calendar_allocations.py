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
    from app.repositories.production_scheduler import lock_scheduler
    from app.services.calendar_plan_linkage import PlanLinkageConflict, assignment_issues, issue, resource_mapping_valid
    lock_scheduler(db)
    assignment = db.scalar(select(CalendarAssignment).where(CalendarAssignment.id == payload.assignment_id).with_for_update())
    if assignment is None:
        raise AllocationError("Назначение не найдено", 404)
    diagnostics = assignment_issues(db, assignment)
    if diagnostics:
        raise PlanLinkageConflict(diagnostics[0])
    if assignment.stage_result_id is None:
        raise PlanLinkageConflict(issue(db, assignment, "calendar_assignment_missing_snapshot", reason="allocation_requires_snapshot"))
    resource = db.get(CapacityResource, payload.resource_key)
    if resource is None:
        raise AllocationError("Ресурс мощности не найден", 404)
    from app.models.technical_card import TechnicalCardStageResult
    node = db.get(TechnicalCardStageResult, assignment.stage_result_id)
    if not resource_mapping_valid(db, resource, assignment.production_stage_id, node.tech_operation_id):
        raise PlanLinkageConflict(issue(db, assignment, "calendar_assignment_snapshot_mismatch", reason="allocation_resource_workshop_mismatch",
                                       actual={"resource_key": resource.resource_key, "work_center_id": resource.work_center_id}))
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
    from app.services.calendar_allocation_consistency import assert_consistency
    previous = list(db.scalars(select(CalendarAllocation).where(CalendarAllocation.assignment_id == assignment.id)))
    assert_consistency(db, assignment, allocations=[*previous, row])
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
