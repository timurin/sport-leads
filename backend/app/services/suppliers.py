from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.models.nomenclature import Nomenclature
from app.models.supplier import Supplier, SupplierPrice
from app.schemas.supplier import (
    SupplierCreate,
    SupplierDetailRead,
    SupplierListItem,
    SupplierPriceCreate,
    SupplierPriceRead,
    SupplierPriceUpdate,
    SupplierUpdate,
)


class SupplierNotFoundError(RuntimeError):
    pass


class SupplierConflictError(RuntimeError):
    pass


class SupplierValidationError(RuntimeError):
    pass


def _price_read(price: SupplierPrice, nomenclature_name: str) -> SupplierPriceRead:
    return SupplierPriceRead(
        id=price.id,
        supplier_id=price.supplier_id,
        nomenclature_id=price.nomenclature_id,
        nomenclature_name=nomenclature_name,
        unit_price=price.unit_price,
        currency=price.currency,
        comment=price.comment,
        created_at=price.created_at,
        updated_at=price.updated_at,
    )


def _detail_read(supplier: Supplier, name_by_id: dict[int, str]) -> SupplierDetailRead:
    return SupplierDetailRead(
        id=supplier.id,
        name=supplier.name,
        code=supplier.code,
        inn=supplier.inn,
        kpp=supplier.kpp,
        phone=supplier.phone,
        email=supplier.email,
        legal_address=supplier.legal_address,
        notes=supplier.notes,
        is_active=supplier.is_active,
        created_at=supplier.created_at,
        updated_at=supplier.updated_at,
        prices=[
            _price_read(price, name_by_id.get(price.nomenclature_id, ""))
            for price in supplier.prices
        ],
    )


def _nomenclature_names(db: Session, nomenclature_ids: list[int]) -> dict[int, str]:
    if not nomenclature_ids:
        return {}
    rows = db.scalars(
        select(Nomenclature).where(Nomenclature.id.in_(nomenclature_ids))
    ).all()
    return {row.id: row.name for row in rows}


def list_suppliers(
    db: Session,
    *,
    search: str | None = None,
    active_only: bool = False,
    limit: int = 100,
    offset: int = 0,
) -> list[SupplierListItem]:
    statement = select(Supplier)
    if active_only:
        statement = statement.where(Supplier.is_active.is_(True))
    if search and search.strip():
        needle = f"%{search.strip()}%"
        statement = statement.where(
            Supplier.name.ilike(needle)
            | Supplier.code.ilike(needle)
            | Supplier.inn.ilike(needle)
        )
    statement = statement.order_by(Supplier.name, Supplier.id).offset(offset).limit(limit)
    rows = list(db.scalars(statement).all())
    return [SupplierListItem.model_validate(row) for row in rows]


def get_supplier(db: Session, supplier_id: int) -> SupplierDetailRead:
    row = db.scalars(
        select(Supplier)
        .where(Supplier.id == supplier_id)
        .options(selectinload(Supplier.prices))
    ).first()
    if row is None:
        raise SupplierNotFoundError("Поставщик не найден")
    names = _nomenclature_names(db, [p.nomenclature_id for p in row.prices])
    return _detail_read(row, names)


def _require_unique_code(
    db: Session, code: str | None, *, exclude_id: int | None = None
) -> None:
    if not code:
        return
    statement = select(Supplier).where(Supplier.code == code)
    if exclude_id is not None:
        statement = statement.where(Supplier.id != exclude_id)
    if db.scalars(statement).first() is not None:
        raise SupplierConflictError("Поставщик с таким кодом уже существует")


def create_supplier(db: Session, payload: SupplierCreate) -> SupplierDetailRead:
    _require_unique_code(db, payload.code)
    row = Supplier(
        name=payload.name,
        code=payload.code,
        inn=payload.inn,
        kpp=payload.kpp,
        phone=payload.phone,
        email=payload.email,
        legal_address=payload.legal_address,
        notes=payload.notes,
        is_active=payload.is_active,
    )
    db.add(row)
    try:
        db.commit()
        db.refresh(row)
    except IntegrityError as error:
        db.rollback()
        raise SupplierConflictError("Поставщик уже существует") from error
    return get_supplier(db, row.id)


def update_supplier(
    db: Session, supplier_id: int, payload: SupplierUpdate
) -> SupplierDetailRead:
    row = db.get(Supplier, supplier_id)
    if row is None:
        raise SupplierNotFoundError("Поставщик не найден")
    changes = payload.model_dump(exclude_unset=True)
    if not changes:
        raise SupplierValidationError("Нет полей для обновления")
    if "code" in changes:
        _require_unique_code(db, changes["code"], exclude_id=supplier_id)
    for field_name, value in changes.items():
        setattr(row, field_name, value)
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise SupplierConflictError("Поставщик уже существует") from error
    return get_supplier(db, supplier_id)


def delete_supplier(db: Session, supplier_id: int) -> None:
    row = db.get(Supplier, supplier_id)
    if row is None:
        raise SupplierNotFoundError("Поставщик не найден")
    has_prices = db.scalars(
        select(SupplierPrice.id).where(SupplierPrice.supplier_id == supplier_id).limit(1)
    ).first()
    if has_prices is not None:
        raise SupplierValidationError(
            "Нельзя удалить поставщика с ценами — сначала удалите цены или деактивируйте"
        )
    db.delete(row)
    db.commit()


def create_supplier_price(
    db: Session, supplier_id: int, payload: SupplierPriceCreate
) -> SupplierPriceRead:
    if db.get(Supplier, supplier_id) is None:
        raise SupplierNotFoundError("Поставщик не найден")
    nomenclature = db.get(Nomenclature, payload.nomenclature_id)
    if nomenclature is None:
        raise SupplierValidationError("Номенклатура не найдена")
    if payload.currency != "RUB":
        raise SupplierValidationError("Валюта MVP только RUB")
    existing = db.scalars(
        select(SupplierPrice).where(
            SupplierPrice.supplier_id == supplier_id,
            SupplierPrice.nomenclature_id == payload.nomenclature_id,
        )
    ).first()
    if existing is not None:
        raise SupplierConflictError("Цена на эту номенклатуру уже есть у поставщика")
    price = SupplierPrice(
        supplier_id=supplier_id,
        nomenclature_id=payload.nomenclature_id,
        unit_price=payload.unit_price,
        currency=payload.currency,
        comment=payload.comment,
    )
    db.add(price)
    try:
        db.commit()
        db.refresh(price)
    except IntegrityError as error:
        db.rollback()
        raise SupplierConflictError("Цена на эту номенклатуру уже есть") from error
    return _price_read(price, nomenclature.name)


def update_supplier_price(
    db: Session,
    supplier_id: int,
    price_id: int,
    payload: SupplierPriceUpdate,
) -> SupplierPriceRead:
    price = db.scalars(
        select(SupplierPrice).where(
            SupplierPrice.id == price_id,
            SupplierPrice.supplier_id == supplier_id,
        )
    ).first()
    if price is None:
        raise SupplierNotFoundError("Цена поставщика не найдена")
    changes = payload.model_dump(exclude_unset=True)
    if not changes:
        raise SupplierValidationError("Нет полей для обновления")
    if changes.get("currency") not in (None, "RUB"):
        raise SupplierValidationError("Валюта MVP только RUB")
    for field_name, value in changes.items():
        setattr(price, field_name, value)
    db.commit()
    db.refresh(price)
    nomenclature = db.get(Nomenclature, price.nomenclature_id)
    return _price_read(price, nomenclature.name if nomenclature else "")


def delete_supplier_price(db: Session, supplier_id: int, price_id: int) -> None:
    price = db.scalars(
        select(SupplierPrice).where(
            SupplierPrice.id == price_id,
            SupplierPrice.supplier_id == supplier_id,
        )
    ).first()
    if price is None:
        raise SupplierNotFoundError("Цена поставщика не найдена")
    db.delete(price)
    db.commit()
