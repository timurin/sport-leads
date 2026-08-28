from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.models.detailing import DetailingItem, detailing_item_product_types
from app.models.product_type import ProductType
from app.schemas.detailing import DetailingItemCreate, DetailingItemUpdate


class DetailingNotFoundError(RuntimeError):
    pass


class DetailingConflictError(RuntimeError):
    pass


class DetailingValidationError(RuntimeError):
    pass


def _normalize_name(name: str) -> str:
    return " ".join(name.strip().split())


def _load_options():
    return selectinload(DetailingItem.applicability_product_types)


def _resolve_product_types(db: Session, ids: list[int]) -> list[ProductType]:
    if not ids:
        raise DetailingValidationError("Выберите хотя бы один вид изделия")
    rows = list(
        db.scalars(select(ProductType).where(ProductType.id.in_(ids))).all()
    )
    by_id = {row.id: row for row in rows}
    missing = [item_id for item_id in ids if item_id not in by_id]
    if missing:
        raise DetailingValidationError("Вид изделия не найден")
    return [by_id[item_id] for item_id in ids]


def list_detailing_items(
    db: Session,
    *,
    search: str | None = None,
    product_type_id: int | None = None,
    limit: int = 100,
    offset: int = 0,
) -> list[DetailingItem]:
    statement = select(DetailingItem).options(_load_options())
    if search and search.strip():
        pattern = f"%{search.strip()}%"
        statement = statement.where(DetailingItem.name.ilike(pattern))
    if product_type_id is not None:
        statement = statement.join(
            detailing_item_product_types,
            detailing_item_product_types.c.detailing_item_id == DetailingItem.id,
        ).where(detailing_item_product_types.c.product_type_id == product_type_id)
    statement = (
        statement.order_by(func.lower(DetailingItem.name), DetailingItem.id)
        .offset(offset)
        .limit(limit)
    )
    return list(db.scalars(statement).unique().all())


def get_detailing_item(db: Session, item_id: int) -> DetailingItem:
    row = db.scalars(
        select(DetailingItem)
        .where(DetailingItem.id == item_id)
        .options(_load_options())
    ).first()
    if row is None:
        raise DetailingNotFoundError("Элемент деталировки не найден")
    return row


def find_detailing_by_name(db: Session, name: str) -> DetailingItem | None:
    normalized = _normalize_name(name)
    if not normalized:
        return None
    return db.scalars(
        select(DetailingItem)
        .where(func.lower(DetailingItem.name) == normalized.casefold())
        .options(_load_options())
    ).first()


def create_detailing_item(db: Session, payload: DetailingItemCreate) -> DetailingItem:
    name = _normalize_name(payload.name)
    if not name:
        raise DetailingValidationError("Укажите наименование")
    product_types = _resolve_product_types(db, payload.applicability_product_type_ids)
    if find_detailing_by_name(db, name) is not None:
        raise DetailingConflictError("Элемент деталировки с таким названием уже существует")
    row = DetailingItem(name=name)
    row.applicability_product_types = product_types
    db.add(row)
    db.commit()
    db.refresh(row)
    return get_detailing_item(db, row.id)


def update_detailing_item(
    db: Session,
    item_id: int,
    payload: DetailingItemUpdate,
) -> DetailingItem:
    row = get_detailing_item(db, item_id)
    changes = payload.model_dump(exclude_unset=True)
    if "name" in changes and changes["name"] is not None:
        name = _normalize_name(changes["name"])
        existing = find_detailing_by_name(db, name)
        if existing is not None and existing.id != item_id:
            raise DetailingConflictError(
                "Элемент деталировки с таким названием уже существует"
            )
        row.name = name
    if "applicability_product_type_ids" in changes and changes[
        "applicability_product_type_ids"
    ] is not None:
        row.applicability_product_types = _resolve_product_types(
            db, changes["applicability_product_type_ids"]
        )
    db.commit()
    return get_detailing_item(db, item_id)


def delete_detailing_item(db: Session, item_id: int) -> None:
    row = get_detailing_item(db, item_id)
    db.delete(row)
    db.commit()


def resolve_or_create_detailing_by_name(
    db: Session,
    *,
    name: str,
    product_type_id: int,
    commit: bool = True,
) -> DetailingItem:
    existing = find_detailing_by_name(db, name)
    product_type = db.get(ProductType, product_type_id)
    if product_type is None:
        raise DetailingValidationError("Вид изделия не найден")
    if existing is not None:
        linked_ids = {row.id for row in existing.applicability_product_types}
        if product_type.id not in linked_ids:
            existing.applicability_product_types.append(product_type)
            if commit:
                db.commit()
                return get_detailing_item(db, existing.id)
            db.flush()
        return existing
    normalized = _normalize_name(name)
    if not normalized:
        raise DetailingValidationError("Укажите наименование")
    row = DetailingItem(name=normalized)
    row.applicability_product_types = [product_type]
    db.add(row)
    if commit:
        db.commit()
        db.refresh(row)
        return get_detailing_item(db, row.id)
    db.flush()
    return row
