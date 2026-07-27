from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.tech_operation import TechOperation
from app.repositories import tech_operations as repo
from app.schemas.tech_operation import TechOperationCreate, TechOperationUpdate


class TechOperationNotFoundError(RuntimeError):
    pass


class TechOperationConflictError(RuntimeError):
    pass


class TechOperationValidationError(RuntimeError):
    pass


def list_tech_operations(
    db: Session,
    search: str | None = None,
    active_only: bool = False,
    limit: int = 100,
    offset: int = 0,
) -> list[TechOperation]:
    return repo.list_tech_operations(
        db,
        search=search,
        active_only=active_only,
        limit=limit,
        offset=offset,
    )


def get_tech_operation(db: Session, operation_id: int) -> TechOperation:
    row = repo.get_tech_operation(db, operation_id)
    if row is None:
        raise TechOperationNotFoundError("Тех операция не найдена")
    return row


def create_tech_operation(db: Session, payload: TechOperationCreate) -> TechOperation:
    if repo.get_tech_operation_by_name(db, payload.name) is not None:
        raise TechOperationConflictError("Тех операция с таким наименованием уже существует")
    if repo.get_tech_operation_by_code(db, payload.code) is not None:
        raise TechOperationConflictError("Тех операция с таким кодом уже существует")

    if payload.production_stage_id is not None:
        from app.repositories import production_stages as stages_repo

        if stages_repo.get_production_stage(db, payload.production_stage_id) is None:
            raise TechOperationValidationError("Этап производства не найден")

    row = TechOperation(
        name=payload.name,
        code=payload.code,
        volume_unit=payload.volume_unit.value,
        production_stage_id=payload.production_stage_id,
        is_active=payload.is_active,
        sort_order=payload.sort_order,
    )
    try:
        repo.add_tech_operation(db, row)
        db.commit()
        db.refresh(row)
        return row
    except IntegrityError as error:
        db.rollback()
        raise TechOperationConflictError(
            "Тех операция с таким наименованием или кодом уже существует"
        ) from error


def update_tech_operation(
    db: Session,
    operation_id: int,
    payload: TechOperationUpdate,
) -> TechOperation:
    row = get_tech_operation(db, operation_id)
    changes = payload.model_dump(exclude_unset=True)
    if not changes:
        raise TechOperationValidationError("Нет полей для обновления")

    if "name" in changes:
        existing = repo.get_tech_operation_by_name(db, changes["name"])
        if existing is not None and existing.id != operation_id:
            raise TechOperationConflictError(
                "Тех операция с таким наименованием уже существует"
            )
    if "code" in changes:
        existing = repo.get_tech_operation_by_code(db, changes["code"])
        if existing is not None and existing.id != operation_id:
            raise TechOperationConflictError("Тех операция с таким кодом уже существует")
    if "volume_unit" in changes and changes["volume_unit"] is not None:
        unit = changes["volume_unit"]
        changes["volume_unit"] = unit.value if hasattr(unit, "value") else unit
    if "production_stage_id" in changes and changes["production_stage_id"] is not None:
        from app.repositories import production_stages as stages_repo

        if stages_repo.get_production_stage(db, changes["production_stage_id"]) is None:
            raise TechOperationValidationError("Этап производства не найден")

    repo.apply_tech_operation_updates(row, changes)
    try:
        db.commit()
        db.refresh(row)
        return row
    except IntegrityError as error:
        db.rollback()
        raise TechOperationConflictError(
            "Тех операция с таким наименованием или кодом уже существует"
        ) from error


def delete_tech_operation(db: Session, operation_id: int) -> None:
    row = get_tech_operation(db, operation_id)
    try:
        repo.delete_tech_operation(db, row)
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise TechOperationConflictError(
            "Нельзя удалить тех операцию: она используется в маршрутах"
        ) from error
