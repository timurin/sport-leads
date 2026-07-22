from decimal import Decimal

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.sewing_operation import SewingOperation
from app.repositories import sewing_operations as repo
from app.schemas.sewing_operation import SewingOperationCreate, SewingOperationUpdate


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


def create_sewing_operation(db: Session, payload: SewingOperationCreate) -> SewingOperation:
    if repo.get_sewing_operation_by_name(db, payload.name) is not None:
        raise SewingOperationConflictError("Операция с таким наименованием уже существует")

    row = SewingOperation(name=payload.name, cost=payload.cost)
    try:
        repo.add_sewing_operation(db, row)
        db.commit()
        db.refresh(row)
        return row
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

    repo.apply_sewing_operation_updates(row, changes)
    try:
        db.commit()
        db.refresh(row)
        return row
    except IntegrityError as error:
        db.rollback()
        raise SewingOperationConflictError(
            "Операция с таким наименованием уже существует"
        ) from error


def delete_sewing_operation(db: Session, operation_id: int) -> None:
    row = get_sewing_operation(db, operation_id)
    repo.delete_sewing_operation(db, row)
    db.commit()
