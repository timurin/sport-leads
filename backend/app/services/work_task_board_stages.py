"""Work task kanban board stages service (Stage 23.8)."""

from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.work_tasks import WorkTask, WorkTaskBoardStage
from app.schemas.work_tasks import (
    WorkTaskBoardStageCreate,
    WorkTaskBoardStageRead,
    WorkTaskBoardStageUpdate,
)


class BoardStageNotFoundError(RuntimeError):
    pass


class BoardStageValidationError(RuntimeError):
    pass


def _to_read(row: WorkTaskBoardStage) -> WorkTaskBoardStageRead:
    return WorkTaskBoardStageRead.model_validate(row)


def list_board_stages(
    db: Session,
    *,
    active_only: bool = True,
) -> list[WorkTaskBoardStageRead]:
    stmt = select(WorkTaskBoardStage).order_by(
        WorkTaskBoardStage.sort_order.asc(),
        WorkTaskBoardStage.id.asc(),
    )
    if active_only:
        stmt = stmt.where(WorkTaskBoardStage.is_active.is_(True))
    rows = db.scalars(stmt).all()
    return [_to_read(row) for row in rows]


def create_board_stage(
    db: Session,
    payload: WorkTaskBoardStageCreate,
) -> WorkTaskBoardStageRead:
    name = payload.name.strip()
    if not name:
        raise BoardStageValidationError("Название стадии обязательно")
    sort_order = payload.sort_order
    if sort_order is None:
        current_max = db.scalar(select(func.max(WorkTaskBoardStage.sort_order))) or 0
        sort_order = int(current_max) + 10
    row = WorkTaskBoardStage(name=name, sort_order=sort_order, is_active=True)
    db.add(row)
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise BoardStageValidationError("Стадия с таким названием уже есть") from error
    db.refresh(row)
    return _to_read(row)


def update_board_stage(
    db: Session,
    stage_id: int,
    payload: WorkTaskBoardStageUpdate,
) -> WorkTaskBoardStageRead:
    row = db.get(WorkTaskBoardStage, stage_id)
    if row is None:
        raise BoardStageNotFoundError("Стадия не найдена")
    data = payload.model_dump(exclude_unset=True)
    if "name" in data:
        name = (data["name"] or "").strip()
        if not name:
            raise BoardStageValidationError("Название стадии обязательно")
        data["name"] = name
    for key, value in data.items():
        setattr(row, key, value)
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise BoardStageValidationError("Стадия с таким названием уже есть") from error
    db.refresh(row)
    return _to_read(row)


def delete_board_stage(db: Session, stage_id: int) -> None:
    row = db.get(WorkTaskBoardStage, stage_id)
    if row is None:
        raise BoardStageNotFoundError("Стадия не найдена")
    active_count = db.scalar(
        select(func.count())
        .select_from(WorkTaskBoardStage)
        .where(WorkTaskBoardStage.is_active.is_(True))
    )
    if row.is_active and int(active_count or 0) <= 1:
        raise BoardStageValidationError("Нельзя удалить последнюю активную стадию")
    # FK ON DELETE SET NULL clears work_tasks.board_stage_id
    db.delete(row)
    db.commit()


def require_board_stage(db: Session, stage_id: int | None) -> None:
    if stage_id is None:
        return
    stage = db.get(WorkTaskBoardStage, stage_id)
    if stage is None or not stage.is_active:
        raise BoardStageValidationError("Стадия канбана не найдена")
