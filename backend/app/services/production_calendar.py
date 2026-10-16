from datetime import date

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.calendar_assignment import CalendarAssignment
from app.models.production_stage import ProductionStage
from app.models.shop_routing import ShopRoutingStageLine
from app.models.technical_card import TechnicalCard
from app.services.calendar_plan_lifecycle import assignment_event, assignment_state
from app.repositories.production_scheduler import lock_scheduler
from app.repositories.production_calendar import assignment_rows, source_rows
from app.schemas.production_calendar import AssignmentCreate, AssignmentRead, AssignmentUpdate, CalendarBoardRead, CalendarSourceRead, CalendarStageRead

ENTRY_STAGE_CODE = "launch_preparation"
ENTRY_STAGE_NAME = "Подготовка к запуску"


class CalendarError(Exception):
    def __init__(self, message: str, status_code: int = 422):
        super().__init__(message)
        self.status_code = status_code


def _read(row, state=None, node=None, db=None) -> AssignmentRead:
    assignment, number, order, name, quantity, stage = row
    if db is not None:
        from app.services.production_state import load_states
        card = db.get(TechnicalCard, assignment.technical_card_id)
        state = load_states(db, [card])[card.id]
        node = next((row for row in card.stage_results if row.id == assignment.stage_result_id), None)
    return AssignmentRead(**{key: getattr(assignment, key) for key in
                             ("id", "technical_card_id", "production_stage_id", "routing_stage_line_id",
                              "planned_date", "planned_start_date", "planned_end_date", "position",
                              "planning_mode", "manual_lock", "note", "created_at", "updated_at")},
                          technical_card_number=number, order_number=order, nomenclature_name=name,
                          quantity=quantity, production_stage_name=stage, production_state=state,
                          snapshot_node_id=None if node is None else node.id,
                          operation_name=None if node is None else node.operation_name or node.stage_label,
                          operation_status=None if node is None else node.status,
                          operation_state=('completed' if node is not None and node.status=='completed' else
                              'current' if state is not None and assignment.stage_result_id in state.current_snapshot_nodes else 'future'))


def board(db: Session, start: date, end: date, stage_id: int | None, *, editable_only: bool = False) -> CalendarBoardRead:
    if end < start or (end - start).days > 366:
        raise CalendarError("Период должен быть от 1 до 367 дней")
    # Retain inactive stages that still have saved queue entries for visibility/moving.
    stages = db.scalars(select(ProductionStage).order_by(ProductionStage.sort_order, ProductionStage.id)).all()
    from app.services.production_state import load_states
    from sqlalchemy.orm import selectinload
    rows=assignment_rows(db,start,end,stage_id,editable_only=editable_only)
    cards=list(db.scalars(select(TechnicalCard).where(TechnicalCard.id.in_({row[0].technical_card_id for row in rows}))
                         .options(selectinload(TechnicalCard.stage_results),selectinload(TechnicalCard.route_edges))))
    states=load_states(db,cards)
    if editable_only:
        rows = [row for row in rows if states[row[0].technical_card_id].lifecycle_status not in {"completed", "cancelled"}]
    nodes={node.id:node for card in cards for node in card.stage_results}
    return CalendarBoardRead(assignments=[_read(row,states.get(row[0].technical_card_id),nodes.get(row[0].stage_result_id)) for row in rows],
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
    lock_scheduler(db)
    # Serialize tail assignment even when this date has no existing queue rows.
    stage = db.scalar(select(ProductionStage).where(ProductionStage.code == ENTRY_STAGE_CODE).with_for_update())
    if stage is None or not stage.is_active:
        raise CalendarError("Стартовая стадия «Подготовка к запуску» не настроена или отключена", 503)
    _validate(db, payload.technical_card_id, stage.id)
    from app.services.route_verification import assert_route_reviewed
    assert_route_reviewed(db, db.get(TechnicalCard, payload.technical_card_id))
    existing = db.scalar(select(CalendarAssignment).where(
        CalendarAssignment.technical_card_id == payload.technical_card_id,
        CalendarAssignment.production_stage_id == stage.id,
        CalendarAssignment.routing_stage_line_id.is_(None),
    ))
    if existing is not None:
        if existing.planned_date == payload.planned_date and existing.note == payload.note:
            return _read(assignment_rows(db, assignment_id=existing.id)[0], db=db)
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
        db.flush()
        assignment_event(db, assignment, "assignment_created", reason="entry_enqueued", source="calendar_api")
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise CalendarError("Назначение уже изменено другим пользователем. Обновите очередь.", 409) from error
    return _read(assignment_rows(db, assignment_id=assignment.id)[0], db=db)


def _route_step_id(db: Session, card_id: int, assignment: CalendarAssignment, payload: AssignmentUpdate) -> int | None:
    stage_id = payload.production_stage_id
    if assignment.stage_result_id is not None and "routing_stage_line_id" not in payload.model_fields_set:
        return assignment.routing_stage_line_id  # Frozen snapshot identity, not live template shape.
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
    lock_scheduler(db)
    values = payload.model_dump(exclude={"planned_start_date", "routing_stage_line_id", "planning_mode"})
    assignment = db.scalar(select(CalendarAssignment).where(CalendarAssignment.id == assignment_id)
                           .with_for_update().execution_options(populate_existing=True))
    if assignment is None:
        raise CalendarError("Назначение не найдено", 404)
    card_id = assignment.technical_card_id
    _validate(db, card_id, payload.production_stage_id)
    line_id = _route_step_id(db, card_id, assignment, payload)
    values["routing_stage_line_id"] = line_id
    if "planning_mode" in payload.model_fields_set:
        values["planning_mode"] = payload.planning_mode
        values["manual_lock"] = payload.planning_mode != "auto"
    from app.services.calendar_plan_linkage import assert_update_mapping
    assert_update_mapping(db, assignment, values)
    from app.services.calendar_allocation_consistency import assert_consistency
    assert_consistency(db, assignment, start=values["planned_date"], end=values["planned_end_date"])
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
    previous = assignment_state(assignment)
    for key, value in values.items():
        setattr(assignment, key, value)
    try:
        if assignment_state(assignment) != previous:
            detached = (previous["routing_stage_line_id"] is not None and line_id is None)
            assignment_event(db, assignment, "assignment_detached" if detached else "assignment_replanned",
                             previous_state=previous, reason="manual_mapping_detached" if detached else "manual_plan_changed",
                             source="calendar_api")
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise CalendarError("Назначение уже изменено другим пользователем. Обновите очередь.", 409) from error
    return _read(assignment_rows(db, assignment_id=assignment.id)[0], db=db)


def remove(db: Session, assignment_id: int) -> None:
    lock_scheduler(db)
    assignment = db.scalar(select(CalendarAssignment).where(CalendarAssignment.id == assignment_id)
                           .with_for_update().execution_options(populate_existing=True))
    if assignment is None:
        raise CalendarError("Назначение не найдено", 404)
    from app.services.calendar_plan_linkage import retire_assignments
    retire_assignments(db, [assignment], reason="explicit_assignment_delete", source="calendar_api")
    db.commit()
