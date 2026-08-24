from decimal import Decimal

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload
from sqlalchemy import select

from app.models.sewing_operation import SewingOperation, SewingOperationFolder
from app.models.shop_routing import WorkCenter
from app.repositories import sewing_operations as repo
from app.schemas.sewing_operation import (
    SewingOperationCreate,
    SewingOperationFolderCreate,
    SewingOperationFolderUpdate,
    SewingOperationUpdate,
)

SEWING_STAGE_CODE = "sewing"


class SewingOperationNotFoundError(RuntimeError):
    pass


class SewingOperationConflictError(RuntimeError):
    pass


class SewingOperationValidationError(RuntimeError):
    pass


class SewingOperationFolderNotFoundError(RuntimeError):
    pass


class SewingOperationFolderConflictError(RuntimeError):
    pass


class SewingOperationFolderValidationError(RuntimeError):
    pass


def list_sewing_operations(
    db: Session,
    search: str | None = None,
    folder_id: int | None = None,
    limit: int = 100,
    offset: int = 0,
) -> list[SewingOperation]:
    return repo.list_sewing_operations(
        db,
        search=search,
        folder_id=folder_id,
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


def _ensure_folder_exists(db: Session, folder_id: int | None) -> None:
    if folder_id is None:
        return
    if repo.get_sewing_operation_folder(db, folder_id) is None:
        raise SewingOperationValidationError("Папка операций пошива не найдена")


def _persist(db: Session, *, commit: bool) -> None:
    if commit:
        db.commit()
    else:
        db.flush()


def create_sewing_operation(
    db: Session, payload: SewingOperationCreate, *, commit: bool = True
) -> SewingOperation:
    if repo.get_sewing_operation_by_name(db, payload.name) is not None:
        raise SewingOperationConflictError("Операция с таким наименованием уже существует")

    _ensure_folder_exists(db, payload.folder_id)
    work_centers = _resolve_sewing_work_centers(db, payload.work_center_ids)
    fields_set = getattr(payload, "model_fields_set", set())
    sort_order = (
        payload.sort_order
        if "sort_order" in fields_set
        else repo.next_operation_sort_order(db, payload.folder_id)
    )

    row = SewingOperation(
        name=payload.name,
        cost=payload.cost,
        quantity_per_item=payload.quantity_per_item,
        duration_seconds=payload.duration_seconds,
        folder_id=payload.folder_id,
        sort_order=sort_order,
    )
    row.work_centers = work_centers
    try:
        repo.add_sewing_operation(db, row)
        _persist(db, commit=commit)
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
    *,
    commit: bool = True,
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

    if "folder_id" in changes:
        _ensure_folder_exists(db, changes["folder_id"])
        if changes["folder_id"] != row.folder_id and "sort_order" not in changes:
            changes["sort_order"] = repo.next_operation_sort_order(
                db, changes["folder_id"]
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

    if "sort_order" in changes and changes["sort_order"] is not None:
        if int(changes["sort_order"]) < 0:
            raise SewingOperationValidationError("Порядок не может быть отрицательным")

    repo.apply_sewing_operation_updates(row, changes)
    if work_center_ids is not None:
        row.work_centers = _resolve_sewing_work_centers(db, work_center_ids)
    try:
        _persist(db, commit=commit)
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


def move_sewing_operation_sibling(
    db: Session, operation_id: int, direction: str
) -> SewingOperation:
    row = get_sewing_operation(db, operation_id)
    siblings = repo.list_sibling_operations(db, row.folder_id)
    index = next((i for i, item in enumerate(siblings) if item.id == row.id), None)
    if index is None:
        raise SewingOperationNotFoundError("Операция пошива не найдена")
    target = index - 1 if direction == "up" else index + 1
    if target < 0 or target >= len(siblings):
        return row
    other = siblings[target]
    row.sort_order, other.sort_order = other.sort_order, row.sort_order
    db.commit()
    return get_sewing_operation(db, operation_id)


def list_sewing_operation_folders(db: Session) -> list[SewingOperationFolder]:
    return repo.list_sewing_operation_folders(db)


def get_sewing_operation_folder(db: Session, folder_id: int) -> SewingOperationFolder:
    row = repo.get_sewing_operation_folder(db, folder_id)
    if row is None:
        raise SewingOperationFolderNotFoundError("Папка операций пошива не найдена")
    return row


def _validate_folder_parent(
    db: Session, folder_id: int | None, parent_id: int | None
) -> None:
    if parent_id is None:
        return
    if folder_id is not None and folder_id == parent_id:
        raise SewingOperationFolderValidationError(
            "Папка не может быть родителем самой себя"
        )
    current = get_sewing_operation_folder(db, parent_id)
    seen: set[int] = set()
    while current is not None:
        if folder_id is not None and current.id == folder_id:
            raise SewingOperationFolderValidationError(
                "Нельзя сделать потомка родителем (цикл)"
            )
        if current.id in seen:
            raise SewingOperationFolderValidationError("Обнаружен цикл в иерархии папок")
        seen.add(current.id)
        if current.parent_id is None:
            break
        current = get_sewing_operation_folder(db, current.parent_id)


def _assert_unique_sibling_folder_name(
    db: Session,
    *,
    parent_id: int | None,
    name: str,
    exclude_id: int | None = None,
) -> None:
    existing = repo.find_sibling_folder_by_name(
        db, parent_id=parent_id, name=name, exclude_id=exclude_id
    )
    if existing is not None:
        raise SewingOperationFolderConflictError(
            "Папка с таким именем уже есть на этом уровне"
        )


def create_sewing_operation_folder(
    db: Session, payload: SewingOperationFolderCreate, *, commit: bool = True
) -> SewingOperationFolder:
    _validate_folder_parent(db, None, payload.parent_id)
    _assert_unique_sibling_folder_name(
        db, parent_id=payload.parent_id, name=payload.name
    )
    fields_set = getattr(payload, "model_fields_set", set())
    sort_order = (
        payload.sort_order
        if "sort_order" in fields_set
        else repo.next_folder_sort_order(db, payload.parent_id)
    )
    row = SewingOperationFolder(
        name=payload.name,
        parent_id=payload.parent_id,
        sort_order=sort_order,
    )
    try:
        repo.add_sewing_operation_folder(db, row)
        _persist(db, commit=commit)
        return get_sewing_operation_folder(db, row.id)
    except IntegrityError as error:
        db.rollback()
        raise SewingOperationFolderConflictError(
            "Папка с таким именем уже есть на этом уровне"
        ) from error


def update_sewing_operation_folder(
    db: Session,
    folder_id: int,
    payload: SewingOperationFolderUpdate,
) -> SewingOperationFolder:
    row = get_sewing_operation_folder(db, folder_id)
    changes = payload.model_dump(exclude_unset=True)
    if not changes:
        raise SewingOperationFolderValidationError("Нет полей для обновления")

    next_parent = changes.get("parent_id", row.parent_id)
    next_name = changes.get("name", row.name)
    if "parent_id" in changes:
        _validate_folder_parent(db, folder_id, changes["parent_id"])
        if changes["parent_id"] != row.parent_id and "sort_order" not in changes:
            changes["sort_order"] = repo.next_folder_sort_order(db, changes["parent_id"])

    _assert_unique_sibling_folder_name(
        db,
        parent_id=next_parent,
        name=next_name,
        exclude_id=folder_id,
    )

    for field_name, value in changes.items():
        setattr(row, field_name, value)
    try:
        db.commit()
        return get_sewing_operation_folder(db, folder_id)
    except IntegrityError as error:
        db.rollback()
        raise SewingOperationFolderConflictError(
            "Папка с таким именем уже есть на этом уровне"
        ) from error


def delete_sewing_operation_folder(db: Session, folder_id: int) -> None:
    row = get_sewing_operation_folder(db, folder_id)
    if repo.count_folder_children(db, folder_id) > 0:
        raise SewingOperationFolderValidationError(
            "Нельзя удалить папку, пока в ней есть вложенные папки или операции"
        )
    repo.delete_sewing_operation_folder(db, row)
    db.commit()


def move_sewing_operation_folder_sibling(
    db: Session, folder_id: int, direction: str
) -> SewingOperationFolder:
    row = get_sewing_operation_folder(db, folder_id)
    siblings = repo.list_sibling_folders(db, row.parent_id)
    index = next((i for i, item in enumerate(siblings) if item.id == row.id), None)
    if index is None:
        raise SewingOperationFolderNotFoundError("Папка операций пошива не найдена")
    target = index - 1 if direction == "up" else index + 1
    if target < 0 or target >= len(siblings):
        return row
    other = siblings[target]
    row.sort_order, other.sort_order = other.sort_order, row.sort_order
    db.commit()
    return get_sewing_operation_folder(db, folder_id)
