from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.sales import Client, ClientFolder


def list_client_folders(db: Session) -> list[ClientFolder]:
    statement = select(ClientFolder).order_by(
        ClientFolder.sort_order,
        func.lower(ClientFolder.name),
        ClientFolder.id,
    )
    return list(db.scalars(statement).all())


def get_client_folder(db: Session, folder_id: int) -> ClientFolder | None:
    return db.get(ClientFolder, folder_id)


def list_sibling_folders(db: Session, parent_id: int | None) -> list[ClientFolder]:
    statement = select(ClientFolder)
    if parent_id is None:
        statement = statement.where(ClientFolder.parent_id.is_(None))
    else:
        statement = statement.where(ClientFolder.parent_id == parent_id)
    statement = statement.order_by(
        ClientFolder.sort_order,
        func.lower(ClientFolder.name),
        ClientFolder.id,
    )
    return list(db.scalars(statement).all())


def find_sibling_folder_by_name(
    db: Session,
    *,
    parent_id: int | None,
    name: str,
    exclude_id: int | None = None,
) -> ClientFolder | None:
    siblings = list_sibling_folders(db, parent_id)
    needle = name.casefold()
    for sibling in siblings:
        if exclude_id is not None and sibling.id == exclude_id:
            continue
        if sibling.name.casefold() == needle:
            return sibling
    return None


def next_folder_sort_order(db: Session, parent_id: int | None) -> int:
    statement = select(func.coalesce(func.max(ClientFolder.sort_order), -1) + 1)
    if parent_id is None:
        statement = statement.where(ClientFolder.parent_id.is_(None))
    else:
        statement = statement.where(ClientFolder.parent_id == parent_id)
    return int(db.scalar(statement) or 0)


def count_folder_children(db: Session, folder_id: int) -> int:
    folders = db.scalar(
        select(func.count())
        .select_from(ClientFolder)
        .where(ClientFolder.parent_id == folder_id)
    )
    clients = db.scalar(
        select(func.count()).select_from(Client).where(Client.folder_id == folder_id)
    )
    return int(folders or 0) + int(clients or 0)


def add_client_folder(db: Session, row: ClientFolder) -> ClientFolder:
    db.add(row)
    db.flush()
    return row


def delete_client_folder(db: Session, row: ClientFolder) -> None:
    db.delete(row)
    db.flush()
