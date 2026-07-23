from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.product_type import ProductType


def list_product_types(
    db: Session,
    *,
    search: str | None = None,
    is_active: bool | None = None,
    limit: int = 100,
    offset: int = 0,
) -> list[ProductType]:
    statement = select(ProductType)
    if search and search.strip():
        pattern = f"%{search.strip()}%"
        statement = statement.where(ProductType.name.ilike(pattern))
    if is_active is not None:
        statement = statement.where(ProductType.is_active.is_(is_active))
    statement = statement.order_by(
        ProductType.sort_order,
        func.lower(ProductType.name),
        ProductType.id,
    ).offset(offset).limit(limit)
    return list(db.scalars(statement).all())


def get_product_type(db: Session, product_type_id: int) -> ProductType | None:
    return db.get(ProductType, product_type_id)


def add_product_type(db: Session, row: ProductType) -> ProductType:
    db.add(row)
    db.flush()
    return row


def apply_product_type_updates(row: ProductType, changes: dict) -> ProductType:
    for field_name, value in changes.items():
        setattr(row, field_name, value)
    return row


def delete_product_type(db: Session, row: ProductType) -> None:
    db.delete(row)
