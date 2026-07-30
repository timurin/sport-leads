from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.warehouse import Warehouse
from app.repositories import warehouses as repo
from app.schemas.warehouse import WarehouseCreate, WarehouseUpdate


class WarehouseNotFoundError(RuntimeError):
    pass


class WarehouseConflictError(RuntimeError):
    pass


class WarehouseValidationError(RuntimeError):
    pass


def list_warehouses(
    db: Session,
    *,
    search: str | None = None,
    active_only: bool = False,
    limit: int = 100,
    offset: int = 0,
) -> list[Warehouse]:
    return repo.list_warehouses(
        db,
        search=search,
        active_only=active_only,
        limit=limit,
        offset=offset,
    )


def get_warehouse(db: Session, warehouse_id: int) -> Warehouse:
    row = repo.get_warehouse(db, warehouse_id)
    if row is None:
        raise WarehouseNotFoundError("Склад не найден")
    return row


def get_default_warehouse(db: Session) -> Warehouse:
    row = repo.get_default_warehouse(db)
    if row is None:
        raise WarehouseNotFoundError("Склад по умолчанию не найден")
    return row


def create_warehouse(db: Session, payload: WarehouseCreate) -> Warehouse:
    if repo.get_warehouse_by_name(db, payload.name) is not None:
        raise WarehouseConflictError("Склад с таким наименованием уже существует")
    if repo.get_warehouse_by_code(db, payload.code) is not None:
        raise WarehouseConflictError("Склад с таким кодом уже существует")

    if payload.is_default:
        if not payload.is_active:
            raise WarehouseValidationError(
                "Склад по умолчанию должен быть активным"
            )
        repo.clear_default_flags(db)

    row = Warehouse(
        name=payload.name,
        code=payload.code,
        is_active=payload.is_active,
        is_default=payload.is_default,
    )
    try:
        repo.add_warehouse(db, row)
        db.commit()
        db.refresh(row)
        return row
    except IntegrityError as error:
        db.rollback()
        raise WarehouseConflictError("Склад уже существует") from error


def update_warehouse(
    db: Session, warehouse_id: int, payload: WarehouseUpdate
) -> Warehouse:
    row = get_warehouse(db, warehouse_id)
    changes = payload.model_dump(exclude_unset=True)
    if not changes:
        raise WarehouseValidationError("Нет полей для обновления")

    if "name" in changes:
        existing = repo.get_warehouse_by_name(db, changes["name"])
        if existing is not None and existing.id != warehouse_id:
            raise WarehouseConflictError(
                "Склад с таким наименованием уже существует"
            )

    if "code" in changes:
        existing = repo.get_warehouse_by_code(db, changes["code"])
        if existing is not None and existing.id != warehouse_id:
            raise WarehouseConflictError("Склад с таким кодом уже существует")

    next_is_default = changes.get("is_default", row.is_default)
    next_is_active = changes.get("is_active", row.is_active)

    if next_is_default and not next_is_active:
        raise WarehouseValidationError(
            "Склад по умолчанию должен быть активным"
        )

    if row.is_default and changes.get("is_default") is False:
        raise WarehouseValidationError(
            "Назначьте другой склад по умолчанию перед снятием флага"
        )

    if next_is_default:
        repo.clear_default_flags(db, except_id=warehouse_id)
        changes["is_default"] = True

    repo.apply_warehouse_updates(row, changes)
    try:
        db.commit()
        db.refresh(row)
        return row
    except IntegrityError as error:
        db.rollback()
        raise WarehouseConflictError("Склад уже существует") from error


def delete_warehouse(db: Session, warehouse_id: int) -> None:
    row = get_warehouse(db, warehouse_id)
    if row.is_default:
        raise WarehouseValidationError(
            "Нельзя удалить склад по умолчанию — сначала назначьте другой"
        )
    repo.delete_warehouse(db, row)
    db.commit()
