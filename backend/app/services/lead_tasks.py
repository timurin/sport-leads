from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.sales import Lead, LeadEvent, LeadEventType, LeadTask, LeadTaskStatus, SalesUser
from app.schemas.sales import LeadTaskCompleteRequest, LeadTaskCreate, LeadTaskRead, LeadTaskUpdate


class LeadTaskOperationError(RuntimeError):
    pass


class LeadNotFoundError(LeadTaskOperationError):
    pass


class LeadTaskNotFoundError(LeadTaskOperationError):
    pass


class LeadTaskAssigneeNotFoundError(LeadTaskOperationError):
    pass


class LeadTaskStateError(LeadTaskOperationError):
    pass


def _locked_lead(db: Session, lead_id: int) -> Lead:
    lead = db.scalar(select(Lead).where(Lead.id == lead_id).with_for_update())
    if lead is None:
        raise LeadNotFoundError("Lead not found")
    return lead


def _locked_task(db: Session, lead_id: int, task_id: int) -> LeadTask:
    task = db.scalar(
        select(LeadTask)
        .where(LeadTask.id == task_id, LeadTask.lead_id == lead_id)
        .with_for_update()
    )
    if task is None:
        raise LeadTaskNotFoundError("Lead task not found")
    return task


def _require_active_user(db: Session, user_id: int | None, *, field: str) -> SalesUser | None:
    if user_id is None:
        return None
    user = db.get(SalesUser, user_id)
    if user is None or not user.is_active:
        raise LeadTaskAssigneeNotFoundError(f"Active {field} user not found")
    return user


def _user_name(db: Session, user_id: int | None) -> str | None:
    if user_id is None:
        return None
    user = db.get(SalesUser, user_id)
    if user is None:
        return f"Сотрудник #{user_id}"
    return user.name


def to_lead_task_read(db: Session, task: LeadTask) -> LeadTaskRead:
    return LeadTaskRead(
        id=task.id,
        lead_id=task.lead_id,
        title=task.title,
        task_type=task.task_type,
        priority=task.priority,
        description=task.description,
        result=task.result,
        status=task.status.value,
        due_at=task.due_at,
        assigned_to_id=task.assigned_to_id,
        assigned_to_name=_user_name(db, task.assigned_to_id),
        created_by_id=task.created_by_id,
        created_by_name=_user_name(db, task.created_by_id),
        created_at=task.created_at,
        completed_at=task.completed_at,
    )


def list_lead_tasks(db: Session, lead_id: int) -> list[LeadTask]:
    if db.get(Lead, lead_id) is None:
        raise LeadNotFoundError("Lead not found")
    return list(
        db.scalars(
            select(LeadTask)
            .where(LeadTask.lead_id == lead_id)
            .order_by(func.coalesce(LeadTask.due_at, LeadTask.created_at).asc(), LeadTask.id.asc())
        ).all()
    )

def create_lead_task(db: Session, lead_id: int, payload: LeadTaskCreate) -> LeadTask:
    lead = _locked_lead(db, lead_id)
    assigned = _require_active_user(db, payload.assigned_to_id, field="assigned_to")
    if assigned is None and lead.responsible_id is not None:
        assigned = _require_active_user(db, lead.responsible_id, field="assigned_to")
    created_by = _require_active_user(db, payload.created_by_id, field="created_by")

    task = LeadTask(
        lead_id=lead_id,
        title=payload.title,
        task_type=payload.task_type,
        priority=payload.priority,
        description=payload.description,
        due_at=payload.due_at,
        assigned_to_id=assigned.id if assigned is not None else None,
        created_by_id=created_by.id if created_by is not None else None,
        status=LeadTaskStatus.OPEN,
    )
    db.add(task)
    db.flush()
    db.add(
        LeadEvent(
            lead_id=lead_id,
            event_type=LeadEventType.TASK_CREATED,
            actor_id=task.created_by_id,
            message=f"Создана задача «{task.title}»",
        )
    )
    db.flush()
    return task


def update_lead_task(
    db: Session,
    lead_id: int,
    task_id: int,
    payload: LeadTaskUpdate,
) -> LeadTask:
    _locked_lead(db, lead_id)
    task = _locked_task(db, lead_id, task_id)
    data = payload.model_dump(exclude_unset=True)
    if "assigned_to_id" in data:
        assigned = _require_active_user(db, data["assigned_to_id"], field="assigned_to")
        data["assigned_to_id"] = assigned.id if assigned is not None else None
    for field_name, value in data.items():
        setattr(task, field_name, value)
    db.flush()
    return task


def complete_lead_task(
    db: Session,
    lead_id: int,
    task_id: int,
    payload: LeadTaskCompleteRequest,
) -> LeadTask:
    _locked_lead(db, lead_id)
    task = _locked_task(db, lead_id, task_id)
    if task.status != LeadTaskStatus.OPEN:
        raise LeadTaskStateError("Only open tasks can be completed")
    task.status = LeadTaskStatus.COMPLETED
    task.result = payload.result
    task.completed_at = datetime.now(UTC)
    db.add(
        LeadEvent(
            lead_id=lead_id,
            event_type=LeadEventType.TASK_COMPLETED,
            actor_id=None,
            message=(
                f"Завершена задача «{task.title}»"
                + (f": {payload.result}" if payload.result else "")
            ),
        )
    )
    db.flush()
    return task


def reopen_lead_task(db: Session, lead_id: int, task_id: int) -> LeadTask:
    _locked_lead(db, lead_id)
    task = _locked_task(db, lead_id, task_id)
    if task.status not in {LeadTaskStatus.COMPLETED, LeadTaskStatus.CANCELLED}:
        raise LeadTaskStateError("Only completed or cancelled tasks can be reopened")
    task.status = LeadTaskStatus.OPEN
    task.result = None
    task.completed_at = None
    db.flush()
    return task


def delete_lead_task(db: Session, lead_id: int, task_id: int) -> None:
    _locked_lead(db, lead_id)
    task = _locked_task(db, lead_id, task_id)
    db.delete(task)
    db.flush()
