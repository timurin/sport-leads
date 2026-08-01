from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.models.sewing_operation import SewingOperation
from app.models.shop_routing import WorkCenter
from app.repositories import sewing_operations as repo
from app.schemas.sewing_operation import SewingOperationCreate, SewingOperationUpdate

SEWING_STAGE_CODE = "sewing"


class SewingOperationNotFoundError(RuntimeError):
    pass


class SewingOperationConflictError(RuntimeError):
    pass


class SewingOperationValidationError(RuntimeError):
    pass


def list_sewing_operations(
    db: Session,
    search: str | None = None,
    limit: int = 100,
    offset: int = 0,
) -> list[SewingOperation]:
    return repo.list_sewing_operations(
        db,
        search=search,
        limit=limit,
        offset=offset,
    )


def get_sewing_operation(db: Session, operation_id: int) -> SewingOperation:
    row = repo.get_sewing_operation(db, operation_id)
    if row is None:
        raise SewingOperationNotFoundError("Операция пошива не найдена")
    return row


def _resolve_sewing_work_centers(
    db: Session, work_center_ids: list[int]
) -> list[WorkCenter]:
    if not work_center_ids:
        return []
    unique_ids = list(dict.fromkeys(work_center_ids))
    rows = list(
        db.scalars(
            select(WorkCenter)
            .options(selectinload(WorkCenter.production_stage))
            .where(WorkCenter.id.in_(unique_ids))
        ).all()
    )
    by_id = {row.id: row for row in rows}
    missing = [item_id for item_id in unique_ids if item_id not in by_id]
    if missing:
        raise SewingOperationValidationError(
            f"Оборудование не найдено: {', '.join(str(item) for item in missing)}"
        )

    ordered: list[WorkCenter] = []
    for item_id in unique_ids:
        row = by_id[item_id]
        stage = row.production_stage
        code = (stage.code if stage is not None else "") or ""
        if stage is None or code.strip().lower() != SEWING_STAGE_CODE:
            raise SewingOperationValidationError(
                "К операциям пошива можно привязать только оборудование цеха Пошив"
            )
        if not row.is_active:
            raise SewingOperationValidationError(
                f"Оборудование «{row.name}» неактивно"
            )
        ordered.append(row)
    return ordered


def create_sewing_operation(db: Session, payload: SewingOperationCreate) -> SewingOperation:
    if repo.get_sewing_operation_by_name(db, payload.name) is not None:
        raise SewingOperationConflictError("Операция с таким наименованием уже существует")

    work_centers = _resolve_sewing_work_centers(db, payload.work_center_ids)
    row = SewingOperation(
        name=payload.name,
        cost=payload.cost,
        quantity_per_item=payload.quantity_per_item,
        duration_seconds=payload.duration_seconds,
    )
    row.work_centers = work_centers
    try:
        repo.add_sewing_operation(db, row)
        db.commit()
        return get_sewing_operation(db, row.id)
    except IntegrityError as error:
        db.rollback()
        raise SewingOperationConflictError(
            "Операция с таким наименованием уже существует"
        ) from error


def update_sewing_operation(
    db: Session,
    operation_id: int,
    payload: SewingOperationUpdate,
) -> SewingOperation:
    row = get_sewing_operation(db, operation_id)
    changes = payload.model_dump(exclude_unset=True)
    if not changes:
        raise SewingOperationValidationError("Нет полей для обновления")

    work_center_ids = changes.pop("work_center_ids", None)

    if "name" in changes:
        existing = repo.get_sewing_operation_by_name(db, changes["name"])
        if existing is not None and existing.id != operation_id:
            raise SewingOperationConflictError(
                "Операция с таким наименованием уже существует"
            )

    if "cost" in changes and changes["cost"] is not None:
        cost = changes["cost"]
        if not isinstance(cost, Decimal):
            cost = Decimal(str(cost))
        if cost < 0:
            raise SewingOperationValidationError("Стоимость не может быть отрицательной")
        changes["cost"] = cost

    if "duration_seconds" in changes and changes["duration_seconds"] is not None:
        duration = int(changes["duration_seconds"])
        if duration < 0:
            raise SewingOperationValidationError(
                "Время выполнения не может быть отрицательным"
            )
        changes["duration_seconds"] = duration

    if "quantity_per_item" in changes and changes["quantity_per_item"] is not None:
        quantity = int(changes["quantity_per_item"])
        if quantity < 1:
            raise SewingOperationValidationError(
                "Количество операций на изделие должно быть ≥ 1"
            )
        changes["quantity_per_item"] = quantity

    repo.apply_sewing_operation_updates(row, changes)
    if work_center_ids is not None:
        row.work_centers = _resolve_sewing_work_centers(db, work_center_ids)
    try:
        db.commit()
        return get_sewing_operation(db, operation_id)
    except IntegrityError as error:
        db.rollback()
        raise SewingOperationConflictError(
            "Операция с таким наименованием уже существует"
        ) from error


def delete_sewing_operation(db: Session, operation_id: int) -> None:
    row = get_sewing_operation(db, operation_id)
    repo.delete_sewing_operation(db, row)
    db.commit()
