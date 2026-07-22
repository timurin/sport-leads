from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.sewing_operation import SewingOperation


def list_sewing_operations(
    db: Session,
    *,
    search: str | None = None,
    limit: int = 100,
    offset: int = 0,
) -> list[SewingOperation]:
    statement = select(SewingOperation)
    if search and search.strip():
        pattern = f"%{search.strip()}%"
        statement = statement.where(SewingOperation.name.ilike(pattern))
    statement = statement.order_by(
        func.lower(SewingOperation.name),
        SewingOperation.id,
    ).offset(offset).limit(limit)
    return list(db.scalars(statement).all())


def get_sewing_operations_by_ids(
    db: Session,
    operation_ids: list[int],
) -> list[SewingOperation]:
    if not operation_ids:
        return []
    rows = list(
        db.scalars(
            select(SewingOperation).where(SewingOperation.id.in_(operation_ids))
        ).all()
    )
    by_id = {row.id: row for row in rows}
    return [by_id[operation_id] for operation_id in operation_ids if operation_id in by_id]


def get_sewing_operation(db: Session, operation_id: int) -> SewingOperation | None:
    return db.get(SewingOperation, operation_id)


def get_sewing_operation_by_name(db: Session, name: str) -> SewingOperation | None:
    return db.scalars(
        select(SewingOperation).where(SewingOperation.name == name)
    ).first()


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
