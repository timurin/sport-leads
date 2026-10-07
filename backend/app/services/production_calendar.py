from datetime import date

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.calendar_assignment import CalendarAssignment
from app.models.production_stage import ProductionStage
from app.models.shop_routing import ShopRoutingStageLine
from app.models.technical_card import TechnicalCard
from app.repositories.production_calendar import assignment_rows, source_rows
from app.schemas.production_calendar import AssignmentCreate, AssignmentRead, AssignmentUpdate, CalendarBoardRead, CalendarSourceRead, CalendarStageRead

ENTRY_STAGE_CODE = "launch_preparation"
ENTRY_STAGE_NAME = "Подготовка к запуску"


class CalendarError(Exception):
    def __init__(self, message: str, status_code: int = 422):
        super().__init__(message)
        self.status_code = status_code


def _read(row) -> AssignmentRead:
    assignment, number, order, name, quantity, stage = row
    return AssignmentRead(**{key: getattr(assignment, key) for key in
                             ("id", "technical_card_id", "production_stage_id", "routing_stage_line_id",
                              "planned_date", "planned_start_date", "planned_end_date", "position",
                              "planning_mode", "manual_lock", "note", "created_at", "updated_at")},
                          technical_card_number=number, order_number=order, nomenclature_name=name,
                          quantity=quantity, production_stage_name=stage)


def board(db: Session, start: date, end: date, stage_id: int | None) -> CalendarBoardRead:
    if end < start or (end - start).days > 366:
        raise CalendarError("Период должен быть от 1 до 367 дней")
    # Retain inactive stages that still have saved queue entries for visibility/moving.
    stages = db.scalars(select(ProductionStage).order_by(ProductionStage.sort_order, ProductionStage.id)).all()
    return CalendarBoardRead(assignments=[_read(row) for row in assignment_rows(db, start, end, stage_id)],
                             stages=[CalendarStageRead(id=s.id, name=s.name, code=s.code) for s in stages])


def sources(db: Session, search: str, limit: int) -> list[CalendarSourceRead]:
    return [CalendarSourceRead(id=r[0], number=r[1], order_number=r[2], nomenclature_name=r[3], quantity=r[4])
            for r in source_rows(db, search, limit)]


def _validate(db: Session, card_id: int, stage_id: int) -> None:
    card = db.get(TechnicalCard, card_id)
    if card is None or card.order_group_id is None:
        raise CalendarError("Выберите существующую standalone ТК")
    if card.status not in ("draft", "in_progress"):
        raise CalendarError("Завершённая или отменённая ТК недоступна для назначения")
    stage = db.get(ProductionStage, stage_id)
    if stage is None or not stage.is_active:
        raise CalendarError("Выберите действующий участок")


def enqueue(db: Session, payload: AssignmentCreate) -> AssignmentRead:
    # Serialize tail assignment even when this date has no existing queue rows.
    stage = db.scalar(select(ProductionStage).where(ProductionStage.code == ENTRY_STAGE_CODE).with_for_update())
    if stage is None or not stage.is_active:
        raise CalendarError("Стартовая стадия «Подготовка к запуску» не настроена или отключена", 503)
    _validate(db, payload.technical_card_id, stage.id)
    existing = db.scalar(select(CalendarAssignment).where(
        CalendarAssignment.technical_card_id == payload.technical_card_id,
        CalendarAssignment.production_stage_id == stage.id,
        CalendarAssignment.routing_stage_line_id.is_(None),
    ))
    if existing is not None:
        if existing.planned_date == payload.planned_date and existing.note == payload.note:
            return _read(assignment_rows(db, assignment_id=existing.id)[0])
        raise CalendarError("ТК уже стоит в подготовке к запуску. Измените существующее назначение.", 409)
    tail = db.scalar(select(func.max(CalendarAssignment.position)).where(
        CalendarAssignment.production_stage_id == stage.id,
        CalendarAssignment.planned_date == payload.planned_date,
    ))
    if tail is not None and tail >= 2147483647:
        raise CalendarError("Достигнут предел позиции очереди. Обратитесь к диспетчеру.", 409)
    assignment = CalendarAssignment(**payload.model_dump(), production_stage_id=stage.id,
                                    position=0 if tail is None else tail + 1,
                                    planning_mode="manual_adjusted", manual_lock=True)
    db.add(assignment)
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise CalendarError("Назначение уже изменено другим пользователем. Обновите очередь.", 409) from error
    return _read(assignment_rows(db, assignment_id=assignment.id)[0])


def _route_step_id(db: Session, card_id: int, assignment: CalendarAssignment, payload: AssignmentUpdate) -> int | None:
    stage_id = payload.production_stage_id
    if "routing_stage_line_id" in payload.model_fields_set:
        line_id = payload.routing_stage_line_id
        if line_id is not None:
            line = db.get(ShopRoutingStageLine, line_id)
            card = db.get(TechnicalCard, card_id)
            if line is None or line.production_stage_id != stage_id or card is None or card.routing_template_id != line.routing_template_id:
                raise CalendarError("Шаг маршрута не найден на выбранном участке этой ТК")
        return line_id
    line_id = assignment.routing_stage_line_id
    if line_id is None:
        return None
    line = db.get(ShopRoutingStageLine, line_id)
    if line is None or line.production_stage_id != stage_id:
        return None
    return line_id


def save(db: Session, payload: AssignmentUpdate, assignment_id: int) -> AssignmentRead:
    values = payload.model_dump(exclude={"planned_start_date", "routing_stage_line_id", "planning_mode"})
    assignment = db.get(CalendarAssignment, assignment_id)
    if assignment is None:
        raise CalendarError("Назначение не найдено", 404)
    card_id = assignment.technical_card_id
    _validate(db, card_id, payload.production_stage_id)
    line_id = _route_step_id(db, card_id, assignment, payload)
    values["routing_stage_line_id"] = line_id
    if "planning_mode" in payload.model_fields_set:
        values["planning_mode"] = payload.planning_mode
        values["manual_lock"] = payload.planning_mode != "auto"
    conflict = select(CalendarAssignment).where(
        CalendarAssignment.technical_card_id == card_id,
        CalendarAssignment.id != assignment.id,
    )
    if line_id is None:
        conflict = conflict.where(
            CalendarAssignment.routing_stage_line_id.is_(None),
            CalendarAssignment.production_stage_id == payload.production_stage_id,
        )
    else:
        conflict = conflict.where(CalendarAssignment.routing_stage_line_id == line_id)
    existing = db.scalar(conflict)
    if existing is not None:
        raise CalendarError("Эта ТК уже назначена на участок. Перенесите существующее назначение.", 409)
    for key, value in values.items():
        setattr(assignment, key, value)
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise CalendarError("Назначение уже изменено другим пользователем. Обновите очередь.", 409) from error
    return _read(assignment_rows(db, assignment_id=assignment.id)[0])


def remove(db: Session, assignment_id: int) -> None:
    assignment = db.get(CalendarAssignment, assignment_id)
    if assignment is None:
        raise CalendarError("Назначение не найдено", 404)
    db.delete(assignment)
    db.commit()
