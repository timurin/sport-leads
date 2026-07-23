from __future__ import annotations

import re
from datetime import date
from decimal import Decimal, InvalidOperation
from types import SimpleNamespace

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.custom_fields import CategoryField, CustomFieldDataType, CustomFieldDefinition, CustomFieldOption, NomenclatureFieldValue
from app.models.nomenclature import Nomenclature, NomenclatureCategory, UnitOfMeasure
from app.schemas.custom_fields import CategoryFieldCreate, CategoryFieldUpdate, CustomFieldDefinitionCreate, CustomFieldDefinitionUpdate, CustomFieldOptionCreate, CustomFieldOptionUpdate, NomenclatureFieldAssignmentInput, NomenclatureFieldValueInput


class CustomFieldNotFoundError(RuntimeError):
    pass


class CustomFieldConflictError(RuntimeError):
    pass


class CustomFieldRuleError(RuntimeError):
    pass


def list_definitions(db: Session, search: str | None, data_type: CustomFieldDataType | None, is_active: bool | None) -> list[CustomFieldDefinition]:
    statement = select(CustomFieldDefinition)
    if data_type is not None:
        statement = statement.where(CustomFieldDefinition.data_type == data_type)
    if is_active is not None:
        statement = statement.where(CustomFieldDefinition.is_active == is_active)
    definitions = list(db.scalars(statement.order_by(CustomFieldDefinition.is_active.desc(), func.lower(CustomFieldDefinition.name))).all())
    if search and search.strip():
        needle = search.strip().casefold()
        definitions = [field for field in definitions if needle in field.code.casefold() or needle in field.name.casefold()]
    return definitions


def get_definition(db: Session, field_id: int) -> CustomFieldDefinition:
    field = db.get(CustomFieldDefinition, field_id)
    if field is None:
        raise CustomFieldNotFoundError("Определение реквизита не найдено")
    return field


def _validate_unit(db: Session, unit_id: int | None) -> None:
    if unit_id is not None and db.get(UnitOfMeasure, unit_id) is None:
        raise CustomFieldRuleError("Единица измерения реквизита не найдена")


def _assert_unique_name(
    db: Session,
    name: str,
    *,
    exclude_id: int | None = None,
) -> None:
    statement = select(CustomFieldDefinition.id).where(
        func.lower(CustomFieldDefinition.name) == name.casefold()
    )
    if exclude_id is not None:
        statement = statement.where(CustomFieldDefinition.id != exclude_id)
    if db.scalar(statement) is not None:
        raise CustomFieldConflictError("Реквизит с таким названием уже существует")


def create_definition(db: Session, payload: CustomFieldDefinitionCreate) -> CustomFieldDefinition:
    _validate_unit(db, payload.unit_id)
    _assert_unique_name(db, payload.name)
    data = payload.model_dump()
    if not data.get("code"):
        base = re.sub(r"[^a-z0-9]+", "_", payload.name.casefold()).strip("_") or "field"
        base = base[:90]
        code = base
        suffix = 2
        while db.scalar(select(CustomFieldDefinition.id).where(CustomFieldDefinition.code == code)) is not None:
            code = f"{base[: max(1, 99 - len(str(suffix)))]}_{suffix}"
            suffix += 1
        data["code"] = code
    field = CustomFieldDefinition(**data)
    db.add(field)
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise CustomFieldConflictError("Реквизит с таким кодом или названием уже существует") from error
    db.refresh(field)
    return field


def update_definition(db: Session, field_id: int, payload: CustomFieldDefinitionUpdate) -> CustomFieldDefinition:
    field = get_definition(db, field_id)
    changes = payload.model_dump(exclude_unset=True)
    _validate_unit(db, changes.get("unit_id", field.unit_id))
    if "name" in changes and changes["name"] is not None:
        _assert_unique_name(db, changes["name"], exclude_id=field_id)
    if "is_active" in changes and changes["is_active"] is False:
        changes["is_active"] = False
    for name, value in changes.items():
        setattr(field, name, value)
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise CustomFieldConflictError("Не удалось обновить реквизит") from error
    db.refresh(field)
    return field


def list_options(db: Session, field_id: int) -> list[CustomFieldOption]:
    get_definition(db, field_id)
    return list(db.scalars(select(CustomFieldOption).where(CustomFieldOption.field_definition_id == field_id).order_by(CustomFieldOption.sort_order, CustomFieldOption.id)).all())


def create_option(db: Session, field_id: int, payload: CustomFieldOptionCreate) -> CustomFieldOption:
    field = get_definition(db, field_id)
    if field.data_type not in (CustomFieldDataType.SINGLE_SELECT, CustomFieldDataType.MULTI_SELECT):
        raise CustomFieldRuleError("Варианты доступны только для полей выбора")
    option = CustomFieldOption(field_definition_id=field_id, **payload.model_dump())
    db.add(option)
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise CustomFieldConflictError("Вариант с таким кодом уже существует") from error
    db.refresh(option)
    return option


def update_option(db: Session, option_id: int, payload: CustomFieldOptionUpdate) -> CustomFieldOption:
    option = db.get(CustomFieldOption, option_id)
    if option is None:
        raise CustomFieldNotFoundError("Вариант реквизита не найден")
    for name, value in payload.model_dump(exclude_unset=True).items():
        setattr(option, name, value)
    db.commit()
    db.refresh(option)
    return option


def _category_chain(db: Session, category_id: int) -> list[NomenclatureCategory]:
    chain: list[NomenclatureCategory] = []
    current = db.get(NomenclatureCategory, category_id)
    if current is None:
        raise CustomFieldNotFoundError("Категория номенклатуры не найдена")
    seen: set[int] = set()
    while current is not None:
        if current.id in seen:
            raise CustomFieldRuleError("Циклическая иерархия категорий запрещена")
        seen.add(current.id)
        chain.append(current)
        current = db.get(NomenclatureCategory, current.parent_id) if current.parent_id is not None else None
    return list(reversed(chain))


def assign_field(db: Session, category_id: int, payload: CategoryFieldCreate) -> CategoryField:
    _category_chain(db, category_id)
    field = get_definition(db, payload.field_definition_id)
    if not field.is_active:
        raise CustomFieldRuleError("Нельзя назначить неактивный реквизит")
    _validate_value(db, field, payload.default_value)
    assignment = CategoryField(category_id=category_id, field_definition_id=payload.field_definition_id, **payload.model_dump(exclude={"field_definition_id", "default_value"}))
    _write_default(assignment, field, payload.default_value, db)
    db.add(assignment)
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise CustomFieldConflictError("Реквизит уже назначен категории") from error
    db.refresh(assignment)
    return assignment


def remove_field(db: Session, category_id: int, field_id: int) -> None:
    assignment = db.scalar(select(CategoryField).where(CategoryField.category_id == category_id, CategoryField.field_definition_id == field_id))
    if assignment is None:
        raise CustomFieldNotFoundError("Назначение реквизита не найдено")
    db.delete(assignment)
    db.commit()


def update_field_assignment(db: Session, category_id: int, field_id: int, payload: CategoryFieldUpdate) -> CategoryField:
    assignment = db.scalar(select(CategoryField).where(CategoryField.category_id == category_id, CategoryField.field_definition_id == field_id))
    if assignment is None:
        raise CustomFieldNotFoundError("Назначение реквизита не найдено")
    field = get_definition(db, field_id)
    changes = payload.model_dump(exclude_unset=True)
    if "default_value" in changes:
        _validate_value(db, field, changes["default_value"])
        _clear_default(assignment)
        _write_default(assignment, field, changes.pop("default_value"), db)
    for name, value in changes.items():
        setattr(assignment, name, value)
    db.commit()
    db.refresh(assignment)
    return assignment


def _clear_default(assignment: CategoryField) -> None:
    assignment.default_string_value = assignment.default_integer_value = assignment.default_decimal_value = assignment.default_boolean_value = assignment.default_date_value = assignment.default_option_id = None
    assignment.default_options = []


def _field_assignments(db: Session, category_id: int) -> list[tuple[CategoryField, int, bool]]:
    result: dict[int, tuple[CategoryField, int, bool]] = {}
    for category in _category_chain(db, category_id):
        assignments = db.scalars(select(CategoryField).where(CategoryField.category_id == category.id)).all()
        for assignment in assignments:
            if category.id != category_id and not assignment.inherit:
                continue
            result[assignment.field_definition_id] = (assignment, category.id, category.id != category_id)
    return sorted(result.values(), key=lambda item: (item[0].sort_order, item[0].id))


def effective_fields(db: Session, category_id: int) -> list[tuple[CategoryField, CustomFieldDefinition, int, bool]]:
    return [(assignment, get_definition(db, assignment.field_definition_id), source_id, inherited) for assignment, source_id, inherited in _field_assignments(db, category_id)]


def _write_default(assignment: CategoryField, field: CustomFieldDefinition, value: object | None, db: Session) -> None:
    if value is None:
        return
    if field.data_type in (CustomFieldDataType.STRING, CustomFieldDataType.TEXT, CustomFieldDataType.COLOR):
        assignment.default_string_value = str(value)
    elif field.data_type == CustomFieldDataType.INTEGER:
        assignment.default_integer_value = int(value)
    elif field.data_type == CustomFieldDataType.DECIMAL:
        assignment.default_decimal_value = Decimal(str(value))
    elif field.data_type == CustomFieldDataType.BOOLEAN:
        assignment.default_boolean_value = bool(value)
    elif field.data_type == CustomFieldDataType.DATE:
        assignment.default_date_value = date.fromisoformat(str(value))
    elif field.data_type == CustomFieldDataType.SINGLE_SELECT:
        assignment.default_option_id = int(value)
    elif field.data_type == CustomFieldDataType.MULTI_SELECT:
        assignment.default_options = list(db.scalars(select(CustomFieldOption).where(CustomFieldOption.id.in_(value))).all())


def _default_value(assignment: CategoryField, field: CustomFieldDefinition) -> object | None:
    if field.data_type == CustomFieldDataType.MULTI_SELECT:
        return [option.id for option in assignment.default_options]
    return {CustomFieldDataType.STRING: assignment.default_string_value, CustomFieldDataType.TEXT: assignment.default_string_value, CustomFieldDataType.COLOR: assignment.default_string_value, CustomFieldDataType.INTEGER: assignment.default_integer_value, CustomFieldDataType.DECIMAL: assignment.default_decimal_value, CustomFieldDataType.BOOLEAN: assignment.default_boolean_value, CustomFieldDataType.DATE: assignment.default_date_value, CustomFieldDataType.SINGLE_SELECT: assignment.default_option_id}.get(field.data_type)


def _validate_value(db: Session, field: CustomFieldDefinition, value: object | None) -> None:
    if value is None:
        return
    try:
        if field.data_type in (CustomFieldDataType.STRING, CustomFieldDataType.TEXT) and not isinstance(value, str):
            raise ValueError
        if field.data_type == CustomFieldDataType.COLOR and (not isinstance(value, str) or re.fullmatch(r"#[0-9A-Fa-f]{6}", value) is None):
            raise ValueError
        if field.data_type == CustomFieldDataType.INTEGER and (isinstance(value, bool) or int(value) != value):
            raise ValueError
        if field.data_type == CustomFieldDataType.DECIMAL:
            Decimal(str(value))
        if field.data_type == CustomFieldDataType.BOOLEAN and not isinstance(value, bool):
            raise ValueError
        if field.data_type == CustomFieldDataType.DATE:
            date.fromisoformat(str(value))
        if field.data_type == CustomFieldDataType.SINGLE_SELECT:
            option = db.get(CustomFieldOption, int(value))
            if option is None or option.field_definition_id != field.id or not option.is_active:
                raise ValueError
        if field.data_type == CustomFieldDataType.MULTI_SELECT:
            if not isinstance(value, list) or any(not isinstance(option_id, int) for option_id in value):
                raise ValueError
            options = db.scalars(select(CustomFieldOption).where(CustomFieldOption.id.in_(value), CustomFieldOption.field_definition_id == field.id, CustomFieldOption.is_active.is_(True))).all()
            if len(options) != len(set(value)):
                raise ValueError
    except (ValueError, TypeError, InvalidOperation):
        raise CustomFieldRuleError(f"Значение реквизита {field.code} не соответствует типу") from None


def _set_value(value_row: NomenclatureFieldValue, field: CustomFieldDefinition, raw: object | None) -> None:
    value_row.string_value = value_row.integer_value = value_row.decimal_value = value_row.boolean_value = value_row.date_value = value_row.option_id = None
    if raw is None:
        return
    if field.data_type in (CustomFieldDataType.STRING, CustomFieldDataType.TEXT, CustomFieldDataType.COLOR): value_row.string_value = str(raw)
    elif field.data_type == CustomFieldDataType.INTEGER: value_row.integer_value = int(raw)
    elif field.data_type == CustomFieldDataType.DECIMAL: value_row.decimal_value = Decimal(str(raw))
    elif field.data_type == CustomFieldDataType.BOOLEAN: value_row.boolean_value = bool(raw)
    elif field.data_type == CustomFieldDataType.DATE: value_row.date_value = date.fromisoformat(str(raw))
    elif field.data_type == CustomFieldDataType.SINGLE_SELECT: value_row.option_id = int(raw)
    elif field.data_type == CustomFieldDataType.MULTI_SELECT: value_row.options = []


def _stored_value(row: NomenclatureFieldValue | None, field: CustomFieldDefinition) -> object | None:
    if row is None: return None
    if field.data_type in (CustomFieldDataType.STRING, CustomFieldDataType.TEXT, CustomFieldDataType.COLOR): return row.string_value
    if field.data_type == CustomFieldDataType.INTEGER: return row.integer_value
    if field.data_type == CustomFieldDataType.DECIMAL: return row.decimal_value
    if field.data_type == CustomFieldDataType.BOOLEAN: return row.boolean_value
    if field.data_type == CustomFieldDataType.DATE: return row.date_value
    if field.data_type == CustomFieldDataType.SINGLE_SELECT: return row.option_id
    return [option.id for option in row.options]


def get_nomenclature_values(db: Session, nomenclature_id: int) -> list[tuple[CategoryField, CustomFieldDefinition, NomenclatureFieldValue | None, int, bool]]:
    nomenclature = db.get(Nomenclature, nomenclature_id)
    if nomenclature is None:
        raise CustomFieldNotFoundError("Номенклатура не найдена")
    rows = {(row.field_definition_id): row for row in db.scalars(select(NomenclatureFieldValue).where(NomenclatureFieldValue.nomenclature_id == nomenclature_id)).all()}
    effective = effective_fields(db, nomenclature.category_id) if nomenclature.category_id is not None else []
    result = [(assignment, field, rows.pop(field.id, None), source_id, inherited) for assignment, field, source_id, inherited in effective]
    for field_id, row in rows.items():
        field = get_definition(db, field_id)
        result.append((SimpleNamespace(is_required=False), field, row, None, False))
    return result


def assign_nomenclature_field(db: Session, nomenclature_id: int, payload: NomenclatureFieldAssignmentInput) -> list[tuple[CategoryField, CustomFieldDefinition, NomenclatureFieldValue | None, int | None, bool]]:
    nomenclature = db.get(Nomenclature, nomenclature_id)
    if nomenclature is None:
        raise CustomFieldNotFoundError("Номенклатура не найдена")
    field = get_definition(db, payload.field_definition_id)
    if not field.is_active:
        raise CustomFieldRuleError("Нельзя назначить неактивный реквизит")
    if any(item[1].id == field.id for item in get_nomenclature_values(db, nomenclature_id)):
        raise CustomFieldConflictError("Реквизит уже назначен номенклатуре или её категории")
    db.add(NomenclatureFieldValue(nomenclature_id=nomenclature_id, field_definition_id=field.id))
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise CustomFieldConflictError("Реквизит уже назначен номенклатуре") from error
    return get_nomenclature_values(db, nomenclature_id)


def remove_nomenclature_field(db: Session, nomenclature_id: int, field_id: int) -> None:
    rows = get_nomenclature_values(db, nomenclature_id)
    if any(field.id == field_id and source_id is not None for _, field, _, source_id, _ in rows):
        raise CustomFieldRuleError("Реквизит назначен категорией и не может быть удалён из карточки")
    row = db.scalar(select(NomenclatureFieldValue).where(NomenclatureFieldValue.nomenclature_id == nomenclature_id, NomenclatureFieldValue.field_definition_id == field_id))
    if row is None:
        raise CustomFieldNotFoundError("Назначение реквизита не найдено")
    db.delete(row)
    db.commit()


def save_nomenclature_values(db: Session, nomenclature_id: int, payload: list[NomenclatureFieldValueInput]) -> list[tuple[CategoryField, CustomFieldDefinition, NomenclatureFieldValue | None, int, bool]]:
    rows = get_nomenclature_values(db, nomenclature_id)
    available = {field.id: (assignment, field) for assignment, field, _, _, _ in rows}
    supplied = {item.field_definition_id: item.value for item in payload}
    if len(supplied) != len(payload):
        raise CustomFieldRuleError("Реквизит указан более одного раза")
    for field_id, value in supplied.items():
        if field_id not in available:
            raise CustomFieldRuleError("Реквизит не назначен категории номенклатуры")
        _validate_value(db, available[field_id][1], value)
    for assignment, field, row, source_id, _ in rows:
        value = supplied.get(field.id, _stored_value(row, field))
        if value is None and assignment.is_required and _default_value(assignment, field) is None:
            raise CustomFieldRuleError(f"Обязательный реквизит {field.name} не заполнен")
        if field.id not in supplied:
            continue
        if value is None and source_id is not None:
            if row is not None:
                db.delete(row)
            continue
        if row is None and value is None:
            continue
        if row is None:
            row = NomenclatureFieldValue(nomenclature_id=nomenclature_id, field_definition_id=field.id)
            db.add(row)
        _set_value(row, field, value)
        if field.data_type == CustomFieldDataType.MULTI_SELECT and value is not None:
            row.options = list(db.scalars(select(CustomFieldOption).where(CustomFieldOption.id.in_(value))).all())
    db.commit()
    return get_nomenclature_values(db, nomenclature_id)
