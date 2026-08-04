from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.models.sewing_operation import SewingOperation, SewingOperationFolder


def _with_work_centers():
    return selectinload(SewingOperation.work_centers)


def list_sewing_operations(
    db: Session,
    *,
    search: str | None = None,
    folder_id: int | None = None,
    limit: int = 100,
    offset: int = 0,
) -> list[SewingOperation]:
    statement = select(SewingOperation).options(_with_work_centers())
    if search and search.strip():
        pattern = f"%{search.strip()}%"
        statement = statement.where(SewingOperation.name.ilike(pattern))
    if folder_id is not None:
        statement = statement.where(SewingOperation.folder_id == folder_id)
    statement = statement.order_by(
        SewingOperation.sort_order,
        func.lower(SewingOperation.name),
        SewingOperation.id,
    ).offset(offset).limit(limit)
    return list(db.scalars(statement).all())


def list_all_sewing_operations(db: Session) -> list[SewingOperation]:
    statement = (
        select(SewingOperation)
        .options(_with_work_centers())
        .order_by(
            SewingOperation.sort_order,
            func.lower(SewingOperation.name),
            SewingOperation.id,
        )
    )
    return list(db.scalars(statement).all())


def get_sewing_operations_by_ids(
    db: Session,
    operation_ids: list[int],
) -> list[SewingOperation]:
    if not operation_ids:
        return []
    rows = list(
        db.scalars(
            select(SewingOperation)
            .options(_with_work_centers())
            .where(SewingOperation.id.in_(operation_ids))
        ).all()
    )
    by_id = {row.id: row for row in rows}
    return [by_id[operation_id] for operation_id in operation_ids if operation_id in by_id]


def get_sewing_operation(db: Session, operation_id: int) -> SewingOperation | None:
    return db.scalars(
        select(SewingOperation)
        .options(_with_work_centers())
        .where(SewingOperation.id == operation_id)
    ).first()


def get_sewing_operation_by_name(db: Session, name: str) -> SewingOperation | None:
    return db.scalars(
        select(SewingOperation).where(SewingOperation.name == name)
    ).first()


def next_operation_sort_order(db: Session, folder_id: int | None) -> int:
    statement = select(func.coalesce(func.max(SewingOperation.sort_order), -1) + 1)
    if folder_id is None:
        statement = statement.where(SewingOperation.folder_id.is_(None))
    else:
        statement = statement.where(SewingOperation.folder_id == folder_id)
    return int(db.scalar(statement) or 0)


def add_sewing_operation(db: Session, row: SewingOperation) -> SewingOperation:
    db.add(row)
    db.flush()
    return row


def apply_sewing_operation_updates(row: SewingOperation, changes: dict) -> SewingOperation:
    for field_name, value in changes.items():
        setattr(row, field_name, value)
    return row


def delete_sewing_operation(db: Session, row: SewingOperation) -> None:
    db.delete(row)
    db.flush()


def list_sewing_operation_folders(db: Session) -> list[SewingOperationFolder]:
    statement = select(SewingOperationFolder).order_by(
        SewingOperationFolder.sort_order,
        func.lower(SewingOperationFolder.name),
        SewingOperationFolder.id,
    )
    return list(db.scalars(statement).all())


def get_sewing_operation_folder(
    db: Session, folder_id: int
) -> SewingOperationFolder | None:
    return db.get(SewingOperationFolder, folder_id)


def find_sibling_folder_by_name(
    db: Session,
    *,
    parent_id: int | None,
    name: str,
    exclude_id: int | None = None,
) -> SewingOperationFolder | None:
    siblings = list_sibling_folders(db, parent_id)
    needle = name.casefold()
    for sibling in siblings:
        if exclude_id is not None and sibling.id == exclude_id:
            continue
        if sibling.name.casefold() == needle:
            return sibling
    return None


def next_folder_sort_order(db: Session, parent_id: int | None) -> int:
    statement = select(func.coalesce(func.max(SewingOperationFolder.sort_order), -1) + 1)
    if parent_id is None:
        statement = statement.where(SewingOperationFolder.parent_id.is_(None))
    else:
        statement = statement.where(SewingOperationFolder.parent_id == parent_id)
    return int(db.scalar(statement) or 0)


def count_folder_children(db: Session, folder_id: int) -> int:
    folders = db.scalar(
        select(func.count())
        .select_from(SewingOperationFolder)
        .where(SewingOperationFolder.parent_id == folder_id)
    )
    ops = db.scalar(
        select(func.count())
        .select_from(SewingOperation)
        .where(SewingOperation.folder_id == folder_id)
    )
    return int(folders or 0) + int(ops or 0)


def add_sewing_operation_folder(
    db: Session, row: SewingOperationFolder
) -> SewingOperationFolder:
    db.add(row)
    db.flush()
    return row


def delete_sewing_operation_folder(db: Session, row: SewingOperationFolder) -> None:
    db.delete(row)
    db.flush()


def list_sibling_folders(
    db: Session, parent_id: int | None
) -> list[SewingOperationFolder]:
    statement = select(SewingOperationFolder)
    if parent_id is None:
        statement = statement.where(SewingOperationFolder.parent_id.is_(None))
    else:
        statement = statement.where(SewingOperationFolder.parent_id == parent_id)
    statement = statement.order_by(
        SewingOperationFolder.sort_order,
        func.lower(SewingOperationFolder.name),
        SewingOperationFolder.id,
    )
    return list(db.scalars(statement).all())


def list_sibling_operations(
    db: Session, folder_id: int | None
) -> list[SewingOperation]:
    statement = select(SewingOperation).options(_with_work_centers())
    if folder_id is None:
        statement = statement.where(SewingOperation.folder_id.is_(None))
    else:
        statement = statement.where(SewingOperation.folder_id == folder_id)
    statement = statement.order_by(
        SewingOperation.sort_order,
        func.lower(SewingOperation.name),
        SewingOperation.id,
    )
    return list(db.scalars(statement).all())
