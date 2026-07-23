from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.product_type import ProductType
from app.repositories import product_types as repo
from app.schemas.product_type import ProductTypeCreate, ProductTypeUpdate


class ProductTypeNotFoundError(RuntimeError):
    pass


class ProductTypeConflictError(RuntimeError):
    pass


def list_product_types(
    db: Session,
    *,
    search: str | None = None,
    is_active: bool | None = None,
    limit: int = 100,
    offset: int = 0,
) -> list[ProductType]:
    return repo.list_product_types(
        db,
        search=search,
        is_active=is_active,
        limit=limit,
        offset=offset,
    )


def get_product_type(db: Session, product_type_id: int) -> ProductType:
    row = repo.get_product_type(db, product_type_id)
    if row is None:
        raise ProductTypeNotFoundError("Тип изделия не найден")
    return row


def create_product_type(db: Session, payload: ProductTypeCreate) -> ProductType:
    row = ProductType(
        name=payload.name,
        is_active=payload.is_active,
        sort_order=payload.sort_order,
    )
    try:
        repo.add_product_type(db, row)
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise ProductTypeConflictError("Тип изделия с таким названием уже существует") from error
    db.refresh(row)
    return row


def update_product_type(
    db: Session,
    product_type_id: int,
    payload: ProductTypeUpdate,
) -> ProductType:
    row = get_product_type(db, product_type_id)
    changes = payload.model_dump(exclude_unset=True)
    if not changes:
        return row
    try:
        repo.apply_product_type_updates(row, changes)
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise ProductTypeConflictError("Тип изделия с таким названием уже существует") from error
    db.refresh(row)
    return row


def delete_product_type(db: Session, product_type_id: int) -> None:
    row = get_product_type(db, product_type_id)
    repo.delete_product_type(db, row)
    db.commit()
