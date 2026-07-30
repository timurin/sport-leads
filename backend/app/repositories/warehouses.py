from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.warehouse import Warehouse


def list_warehouses(
    db: Session,
    *,
    search: str | None = None,
    active_only: bool = False,
    limit: int = 100,
    offset: int = 0,
) -> list[Warehouse]:
    statement = select(Warehouse)
    if active_only:
        statement = statement.where(Warehouse.is_active.is_(True))
    if search and search.strip():
        needle = f"%{search.strip()}%"
        statement = statement.where(
            Warehouse.name.ilike(needle) | Warehouse.code.ilike(needle)
        )
    statement = statement.order_by(
        Warehouse.is_default.desc(),
        Warehouse.name,
        Warehouse.id,
    ).offset(offset).limit(limit)
    return list(db.scalars(statement).all())


def get_warehouse(db: Session, warehouse_id: int) -> Warehouse | None:
    return db.get(Warehouse, warehouse_id)


def get_warehouse_by_name(db: Session, name: str) -> Warehouse | None:
    return db.scalars(select(Warehouse).where(Warehouse.name == name)).first()


def get_warehouse_by_code(db: Session, code: str) -> Warehouse | None:
    return db.scalars(select(Warehouse).where(Warehouse.code == code)).first()


def get_default_warehouse(db: Session) -> Warehouse | None:
    return db.scalars(
        select(Warehouse)
        .where(Warehouse.is_default.is_(True), Warehouse.is_active.is_(True))
        .order_by(Warehouse.id)
    ).first()


def clear_default_flags(db: Session, *, except_id: int | None = None) -> None:
    statement = select(Warehouse).where(Warehouse.is_default.is_(True))
    for row in db.scalars(statement).all():
        if except_id is not None and row.id == except_id:
            continue
        row.is_default = False


def add_warehouse(db: Session, row: Warehouse) -> Warehouse:
    db.add(row)
    db.flush()
    return row


def apply_warehouse_updates(row: Warehouse, changes: dict) -> Warehouse:
    for field_name, value in changes.items():
        setattr(row, field_name, value)
    return row


def delete_warehouse(db: Session, row: Warehouse) -> None:
    db.delete(row)
    db.flush()
