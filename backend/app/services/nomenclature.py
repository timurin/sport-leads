from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.nomenclature import Nomenclature, NomenclatureCategory, NomenclatureType, UnitOfMeasure
from app.schemas.nomenclature import (
    NomenclatureCategoryCreate,
    NomenclatureCategoryUpdate,
    NomenclatureCreate,
    NomenclatureUpdate,
    UnitOfMeasureCreate,
    UnitOfMeasureUpdate,
)


class NomenclatureNotFoundError(RuntimeError):
    pass


class NomenclatureArticleConflictError(RuntimeError):
    pass


class NomenclatureCategoryNotFoundError(RuntimeError):
    pass


class NomenclatureCategoryConflictError(RuntimeError):
    pass


class NomenclatureCategoryRuleError(RuntimeError):
    pass


class UnitOfMeasureNotFoundError(RuntimeError):
    pass


class UnitOfMeasureConflictError(RuntimeError):
    pass


class UnitOfMeasureRuleError(RuntimeError):
    pass


def list_units(db: Session, search: str | None, unit_category: str | None, is_active: bool | None) -> list[UnitOfMeasure]:
    statement = select(UnitOfMeasure)
    if search and search.strip():
        pattern = f"%{search.strip()}%"
        statement = statement.where(or_(UnitOfMeasure.code.ilike(pattern), UnitOfMeasure.name.ilike(pattern), UnitOfMeasure.symbol.ilike(pattern)))
    if unit_category:
        statement = statement.where(UnitOfMeasure.unit_category == unit_category)
    if is_active is not None:
        statement = statement.where(UnitOfMeasure.is_active == is_active)
    return list(db.scalars(statement.order_by(UnitOfMeasure.is_active.desc(), UnitOfMeasure.code)).all())


def get_unit(db: Session, unit_id: int) -> UnitOfMeasure:
    unit = db.get(UnitOfMeasure, unit_id)
    if unit is None:
        raise UnitOfMeasureNotFoundError("Единица измерения не найдена")
    return unit


def create_unit(db: Session, payload: UnitOfMeasureCreate) -> UnitOfMeasure:
    unit = UnitOfMeasure(**payload.model_dump())
    db.add(unit)
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise UnitOfMeasureConflictError("Единица с таким кодом уже существует") from error
    db.refresh(unit)
    return unit


def update_unit(db: Session, unit_id: int, payload: UnitOfMeasureUpdate) -> UnitOfMeasure:
    unit = get_unit(db, unit_id)
    changes = payload.model_dump(exclude_unset=True)
    if unit.is_system and changes.get("is_active") is False:
        raise UnitOfMeasureRuleError("Системную единицу нельзя деактивировать")
    for field_name, value in changes.items():
        setattr(unit, field_name, value)
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise UnitOfMeasureConflictError("Не удалось обновить единицу измерения") from error
    db.refresh(unit)
    return unit


def validate_storage_unit(db: Session, unit_id: int | None, allow_inactive: bool = False) -> None:
    if unit_id is None:
        return
    unit = get_unit(db, unit_id)
    if not unit.is_active and not allow_inactive:
        raise UnitOfMeasureRuleError("Нельзя назначить неактивную единицу измерения")


def list_nomenclature(db: Session, search: str | None, is_active: bool | None, limit: int, offset: int) -> list[Nomenclature]:
    statement = select(Nomenclature)
    if search and search.strip():
        pattern = f"%{search.strip()}%"
        statement = statement.where(or_(Nomenclature.name.ilike(pattern), Nomenclature.article.ilike(pattern), Nomenclature.category.ilike(pattern)))
    if is_active is not None:
        statement = statement.where(Nomenclature.is_active == is_active)
    statement = statement.order_by(Nomenclature.is_active.desc(), func.lower(Nomenclature.name), Nomenclature.id).offset(offset).limit(limit)
    return list(db.scalars(statement).all())


def get_nomenclature(db: Session, nomenclature_id: int) -> Nomenclature:
    item = db.get(Nomenclature, nomenclature_id)
    if item is None:
        raise NomenclatureNotFoundError("Номенклатура не найдена")
    return item


def list_categories(db: Session, is_active: bool | None = None) -> list[NomenclatureCategory]:
    statement = select(NomenclatureCategory)
    if is_active is not None:
        statement = statement.where(NomenclatureCategory.is_active == is_active)
    return list(db.scalars(statement.order_by(NomenclatureCategory.sort_order, func.lower(NomenclatureCategory.name), NomenclatureCategory.id)).all())


def get_category(db: Session, category_id: int) -> NomenclatureCategory:
    category = db.get(NomenclatureCategory, category_id)
    if category is None:
        raise NomenclatureCategoryNotFoundError("Категория номенклатуры не найдена")
    return category


def _validate_category_parent(db: Session, category_id: int | None, parent_id: int | None, nomenclature_type: NomenclatureType) -> None:
    if parent_id is None:
        return
    if category_id == parent_id:
        raise NomenclatureCategoryRuleError("Категория не может быть родителем самой себя")
    parent = get_category(db, parent_id)
    if parent.nomenclature_type != nomenclature_type:
        raise NomenclatureCategoryRuleError("Тип родительской категории должен совпадать")
    seen: set[int] = set()
    current = parent
    while current.parent_id is not None:
        if current.id in seen or current.id == category_id:
            raise NomenclatureCategoryRuleError("Циклическая иерархия категорий запрещена")
        seen.add(current.id)
        current = get_category(db, current.parent_id)


def create_category(db: Session, payload: NomenclatureCategoryCreate) -> NomenclatureCategory:
    _validate_category_parent(db, None, payload.parent_id, payload.nomenclature_type)
    category = NomenclatureCategory(**payload.model_dump())
    db.add(category)
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise NomenclatureCategoryConflictError("Категория с таким кодом уже существует") from error
    db.refresh(category)
    return category


def update_category(db: Session, category_id: int, payload: NomenclatureCategoryUpdate) -> NomenclatureCategory:
    category = get_category(db, category_id)
    changes = payload.model_dump(exclude_unset=True)
    target_type = changes.get("nomenclature_type", category.nomenclature_type)
    _validate_category_parent(db, category_id, changes.get("parent_id", category.parent_id), target_type)
    if target_type != category.nomenclature_type and category.children:
        raise NomenclatureCategoryRuleError("Нельзя изменить тип категории с дочерними категориями")
    if target_type != category.nomenclature_type and category.nomenclatures:
        raise NomenclatureCategoryRuleError("Нельзя изменить тип категории с привязанной номенклатурой")
    for field_name, value in changes.items():
        setattr(category, field_name, value)
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise NomenclatureCategoryConflictError("Категория с таким кодом уже существует") from error
    db.refresh(category)
    return category


def _validate_nomenclature_category(db: Session, category_id: int | None, nomenclature_type: NomenclatureType) -> None:
    if category_id is None:
        return
    category = get_category(db, category_id)
    if category.nomenclature_type != nomenclature_type:
        raise NomenclatureCategoryRuleError("Тип номенклатуры не совместим с категорией")


def create_nomenclature(db: Session, payload: NomenclatureCreate) -> Nomenclature:
    _validate_nomenclature_category(db, payload.category_id, payload.nomenclature_type)
    validate_storage_unit(db, payload.storage_unit_id)
    item = Nomenclature(**payload.model_dump())
    db.add(item)
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise NomenclatureArticleConflictError("Номенклатура с таким артикулом уже существует") from error
    db.refresh(item)
    return item


def update_nomenclature(db: Session, nomenclature_id: int, payload: NomenclatureUpdate) -> Nomenclature:
    item = get_nomenclature(db, nomenclature_id)
    changes = payload.model_dump(exclude_unset=True)
    target_type = changes.get("nomenclature_type", item.nomenclature_type)
    target_category_id = changes.get("category_id", item.category_id)
    _validate_nomenclature_category(db, target_category_id, target_type)
    validate_storage_unit(
        db,
        changes.get("storage_unit_id", item.storage_unit_id),
        allow_inactive="storage_unit_id" not in changes or changes.get("storage_unit_id") == item.storage_unit_id,
    )
    for field_name, value in changes.items():
        setattr(item, field_name, value)
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise NomenclatureArticleConflictError("Номенклатура с таким артикулом уже существует") from error
    db.refresh(item)
    return item
