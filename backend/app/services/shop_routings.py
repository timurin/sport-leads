from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.shop_routing import ShopRoutingStageLine, ShopRoutingTemplate, WorkCenter
from app.repositories import production_stages as stages_repo
from app.repositories import shop_routings as repo
from app.repositories import tech_operations as tech_ops_repo
from app.schemas.shop_routing import (
    ShopRoutingStageLineWrite,
    ShopRoutingTemplateCreate,
    ShopRoutingTemplateUpdate,
    WorkCenterCreate,
    WorkCenterUpdate,
)


class WorkCenterNotFoundError(RuntimeError):
    pass


class WorkCenterConflictError(RuntimeError):
    pass


class WorkCenterValidationError(RuntimeError):
    pass


class ShopRoutingNotFoundError(RuntimeError):
    pass


class ShopRoutingConflictError(RuntimeError):
    pass


class ShopRoutingValidationError(RuntimeError):
    pass


def list_work_centers(
    db: Session,
    search: str | None = None,
    active_only: bool = False,
    production_stage_id: int | None = None,
    production_stage_code: str | None = None,
    limit: int = 100,
    offset: int = 0,
) -> list[WorkCenter]:
    return repo.list_work_centers(
        db,
        search=search,
        active_only=active_only,
        production_stage_id=production_stage_id,
        production_stage_code=production_stage_code,
        limit=limit,
        offset=offset,
    )


def get_work_center(db: Session, work_center_id: int) -> WorkCenter:
    row = repo.get_work_center(db, work_center_id)
    if row is None:
        raise WorkCenterNotFoundError("Оборудование не найдено")
    return row


def create_work_center(db: Session, payload: WorkCenterCreate) -> WorkCenter:
    if repo.get_work_center_by_name(db, payload.name) is not None:
        raise WorkCenterConflictError("Оборудование с таким наименованием уже существует")
    if repo.get_work_center_by_code(db, payload.code) is not None:
        raise WorkCenterConflictError("Оборудование с таким кодом уже существует")
    if payload.production_stage_id is not None:
        if stages_repo.get_production_stage(db, payload.production_stage_id) is None:
            raise WorkCenterValidationError("Этап производства не найден")
    row = WorkCenter(
        name=payload.name,
        code=payload.code,
        production_stage_id=payload.production_stage_id,
        is_active=payload.is_active,
    )
    try:
        repo.add_work_center(db, row)
        db.commit()
        db.refresh(row)
        return row
    except IntegrityError as error:
        db.rollback()
        raise WorkCenterConflictError(
            "Оборудование с таким наименованием или кодом уже существует"
        ) from error


def update_work_center(
    db: Session, work_center_id: int, payload: WorkCenterUpdate
) -> WorkCenter:
    row = get_work_center(db, work_center_id)
    changes = payload.model_dump(exclude_unset=True)
    if not changes:
        raise WorkCenterValidationError("Нет полей для обновления")
    if "name" in changes:
        existing = repo.get_work_center_by_name(db, changes["name"])
        if existing is not None and existing.id != work_center_id:
            raise WorkCenterConflictError(
                "Оборудование с таким наименованием уже существует"
            )
    if "code" in changes:
        existing = repo.get_work_center_by_code(db, changes["code"])
        if existing is not None and existing.id != work_center_id:
            raise WorkCenterConflictError("Оборудование с таким кодом уже существует")
    if "production_stage_id" in changes and changes["production_stage_id"] is not None:
        if stages_repo.get_production_stage(db, changes["production_stage_id"]) is None:
            raise WorkCenterValidationError("Этап производства не найден")
    repo.apply_work_center_updates(row, changes)
    try:
        db.commit()
        db.refresh(row)
        return row
    except IntegrityError as error:
        db.rollback()
        raise WorkCenterConflictError(
            "Оборудование с таким наименованием или кодом уже существует"
        ) from error


def delete_work_center(db: Session, work_center_id: int) -> None:
    row = get_work_center(db, work_center_id)
    repo.delete_work_center(db, row)
    db.commit()


def list_routing_templates(
    db: Session,
    search: str | None = None,
    active_only: bool = False,
    limit: int = 100,
    offset: int = 0,
) -> list[ShopRoutingTemplate]:
    return repo.list_routing_templates(
        db, search=search, active_only=active_only, limit=limit, offset=offset
    )


def get_routing_template(db: Session, template_id: int) -> ShopRoutingTemplate:
    row = repo.get_routing_template(db, template_id)
    if row is None:
        raise ShopRoutingNotFoundError("Маршрут не найден")
    return row


def _validate_stages(
    db: Session, stages: list[ShopRoutingStageLineWrite]
) -> list[ShopRoutingStageLine]:
    if not stages:
        raise ShopRoutingValidationError("Маршрут должен содержать хотя бы один этап")
    orders = [stage.stage_order for stage in stages]
    if len(orders) != len(set(orders)):
        raise ShopRoutingValidationError("Порядковые номера этапов должны быть уникальны")
    expected = list(range(1, len(stages) + 1))
    if sorted(orders) != expected:
        raise ShopRoutingValidationError(
            "Этапы должны иметь непрерывный порядок 1…N без пропусков"
        )
    lines: list[ShopRoutingStageLine] = []
    for stage in sorted(stages, key=lambda item: item.stage_order):
        production_stage = stages_repo.get_production_stage(db, stage.production_stage_id)
        if production_stage is None:
            raise ShopRoutingValidationError(
                f"Этап производства id={stage.production_stage_id} не найден"
            )
        label = (stage.stage_label or production_stage.name).strip()
        if not label:
            raise ShopRoutingValidationError("Наименование этапа не может быть пустым")

        if stage.tech_operation_id is not None:
            op = tech_ops_repo.get_tech_operation(db, stage.tech_operation_id)
            if op is None:
                raise ShopRoutingValidationError(
                    f"Тех операция id={stage.tech_operation_id} не найдена"
                )
            if (
                op.production_stage_id is not None
                and op.production_stage_id != stage.production_stage_id
            ):
                raise ShopRoutingValidationError(
                    f"Тех операция «{op.name}» относится к другому цеху"
                )
        if stage.work_center_id is not None:
            wc = repo.get_work_center(db, stage.work_center_id)
            if wc is None:
                raise ShopRoutingValidationError(
                    f"Оборудование id={stage.work_center_id} не найдено"
                )
            if (
                wc.production_stage_id is not None
                and wc.production_stage_id != stage.production_stage_id
            ):
                raise ShopRoutingValidationError(
                    f"Оборудование «{wc.name}» относится к другому цеху"
                )
        lines.append(
            ShopRoutingStageLine(
                stage_order=stage.stage_order,
                production_stage_id=stage.production_stage_id,
                stage_label=label,
                tech_operation_id=stage.tech_operation_id,
                work_center_id=stage.work_center_id,
                is_quality_checkpoint=stage.is_quality_checkpoint,
            )
        )
    return lines


def create_routing_template(
    db: Session, payload: ShopRoutingTemplateCreate
) -> ShopRoutingTemplate:
    if repo.get_routing_template_by_name(db, payload.name) is not None:
        raise ShopRoutingConflictError("Маршрут с таким наименованием уже существует")
    if payload.code and repo.get_routing_template_by_code(db, payload.code) is not None:
        raise ShopRoutingConflictError("Маршрут с таким кодом уже существует")

    lines = _validate_stages(db, payload.stages)
    row = ShopRoutingTemplate(
        name=payload.name,
        code=payload.code,
        is_active=payload.is_active,
        notes=payload.notes,
    )
    try:
        repo.add_routing_template(db, row)
        for line in lines:
            line.routing_template_id = row.id
            db.add(line)
        db.commit()
        return get_routing_template(db, row.id)
    except IntegrityError as error:
        db.rollback()
        raise ShopRoutingConflictError(
            "Маршрут с таким наименованием или кодом уже существует"
        ) from error


def update_routing_template(
    db: Session,
    template_id: int,
    payload: ShopRoutingTemplateUpdate,
) -> ShopRoutingTemplate:
    row = get_routing_template(db, template_id)
    changes = payload.model_dump(exclude_unset=True)
    stages = changes.pop("stages", None)
    if not changes and stages is None:
        raise ShopRoutingValidationError("Нет полей для обновления")

    if "name" in changes:
        existing = repo.get_routing_template_by_name(db, changes["name"])
        if existing is not None and existing.id != template_id:
            raise ShopRoutingConflictError(
                "Маршрут с таким наименованием уже существует"
            )
    if "code" in changes and changes["code"] is not None:
        existing = repo.get_routing_template_by_code(db, changes["code"])
        if existing is not None and existing.id != template_id:
            raise ShopRoutingConflictError("Маршрут с таким кодом уже существует")

    for field_name, value in changes.items():
        setattr(row, field_name, value)

    if stages is not None:
        stage_payloads = [ShopRoutingStageLineWrite.model_validate(item) for item in stages]
        lines = _validate_stages(db, stage_payloads)
        repo.replace_stage_lines(db, row, lines)

    try:
        db.commit()
        return get_routing_template(db, template_id)
    except IntegrityError as error:
        db.rollback()
        raise ShopRoutingConflictError(
            "Маршрут с таким наименованием или кодом уже существует"
        ) from error


def delete_routing_template(db: Session, template_id: int) -> None:
    row = get_routing_template(db, template_id)
    repo.delete_routing_template(db, row)
    db.commit()
