from __future__ import annotations

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.sales import ClientFolder
from app.repositories import client_folders as repo
from app.schemas.client_folders import (
    ClientFolderCreate,
    ClientFolderRead,
    ClientFolderUpdate,
)


class ClientFolderNotFoundError(RuntimeError):
    pass


class ClientFolderConflictError(RuntimeError):
    pass


class ClientFolderValidationError(RuntimeError):
    pass


def to_client_folder_read(row: ClientFolder) -> ClientFolderRead:
    return ClientFolderRead.model_validate(row)


def list_client_folders(db: Session) -> list[ClientFolderRead]:
    return [to_client_folder_read(row) for row in repo.list_client_folders(db)]


def get_client_folder(db: Session, folder_id: int) -> ClientFolder:
    row = repo.get_client_folder(db, folder_id)
    if row is None:
        raise ClientFolderNotFoundError("Папка клиентов не найдена")
    return row


def get_client_folder_read(db: Session, folder_id: int) -> ClientFolderRead:
    return to_client_folder_read(get_client_folder(db, folder_id))


def _validate_folder_parent(
    db: Session, folder_id: int | None, parent_id: int | None
) -> None:
    if parent_id is None:
        return
    if folder_id is not None and folder_id == parent_id:
        raise ClientFolderValidationError("Папка не может быть родителем самой себя")
    current = get_client_folder(db, parent_id)
    seen: set[int] = set()
    while current is not None:
        if folder_id is not None and current.id == folder_id:
            raise ClientFolderValidationError("Нельзя сделать потомка родителем (цикл)")
        if current.id in seen:
            raise ClientFolderValidationError("Обнаружен цикл в иерархии папок")
        seen.add(current.id)
        if current.parent_id is None:
            break
        current = get_client_folder(db, current.parent_id)


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
        raise ClientFolderConflictError("Папка с таким именем уже есть на этом уровне")


def create_client_folder(db: Session, payload: ClientFolderCreate) -> ClientFolderRead:
    _validate_folder_parent(db, None, payload.parent_id)
    _assert_unique_sibling_folder_name(db, parent_id=payload.parent_id, name=payload.name)
    fields_set = getattr(payload, "model_fields_set", set())
    sort_order = (
        payload.sort_order
        if "sort_order" in fields_set
        else repo.next_folder_sort_order(db, payload.parent_id)
    )
    row = ClientFolder(
        name=payload.name,
        parent_id=payload.parent_id,
        sort_order=sort_order,
    )
    try:
        repo.add_client_folder(db, row)
        db.commit()
        return get_client_folder_read(db, row.id)
    except IntegrityError as error:
        db.rollback()
        raise ClientFolderConflictError(
            "Папка с таким именем уже есть на этом уровне"
        ) from error


def update_client_folder(
    db: Session,
    folder_id: int,
    payload: ClientFolderUpdate,
) -> ClientFolderRead:
    row = get_client_folder(db, folder_id)
    changes = payload.model_dump(exclude_unset=True)
    if not changes:
        raise ClientFolderValidationError("Нет полей для обновления")

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
        return get_client_folder_read(db, folder_id)
    except IntegrityError as error:
        db.rollback()
        raise ClientFolderConflictError(
            "Папка с таким именем уже есть на этом уровне"
        ) from error


def delete_client_folder(db: Session, folder_id: int) -> None:
    row = get_client_folder(db, folder_id)
    if repo.count_folder_children(db, folder_id) > 0:
        raise ClientFolderValidationError(
            "Нельзя удалить папку, пока в ней есть вложенные папки или клиенты"
        )
    repo.delete_client_folder(db, row)
    db.commit()


def move_client_folder_sibling(
    db: Session, folder_id: int, direction: str
) -> ClientFolderRead:
    row = get_client_folder(db, folder_id)
    siblings = repo.list_sibling_folders(db, row.parent_id)
    index = next((i for i, item in enumerate(siblings) if item.id == row.id), None)
    if index is None:
        raise ClientFolderNotFoundError("Папка клиентов не найдена")
    target = index - 1 if direction == "up" else index + 1
    if target < 0 or target >= len(siblings):
        return to_client_folder_read(row)
    other = siblings[target]
    row.sort_order, other.sort_order = other.sort_order, row.sort_order
    db.commit()
    return get_client_folder_read(db, folder_id)
