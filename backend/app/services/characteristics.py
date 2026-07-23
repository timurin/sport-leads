from __future__ import annotations

from datetime import date
from decimal import Decimal, InvalidOperation
from itertools import product
import re
from types import SimpleNamespace

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.characteristics import (
    OPTION_KINDS,
    VARIANT_KINDS,
    CategoryCharacteristic,
    CharacteristicDefinition,
    CharacteristicOption,
    NomenclatureCharacteristic,
    NomenclatureCharacteristicValue,
    NomenclatureVariant,
    nomenclature_characteristic_value_options,
    variant_options,
)
from app.models.nomenclature import Nomenclature, NomenclatureCategory, UnitOfMeasure
from app.schemas.characteristics import (
    CategoryCharacteristicCreate,
    CategoryCharacteristicUpdate,
    CharacteristicDefinitionCreate,
    CharacteristicDefinitionUpdate,
    CharacteristicOptionCreate,
    CharacteristicOptionUpdate,
    NomenclatureCharacteristicAssignmentInput,
    NomenclatureCharacteristicCreate,
    NomenclatureCharacteristicValueInput,
    VariantCreate,
    VariantGenerateRequest,
    VariantUpdate,
)
from app.services.characteristic_operations_journal import (
    characteristic_has_journal_operations,
    characteristic_option_has_journal_operations,
)


class CharacteristicError(RuntimeError):
    pass


class CharacteristicConflictError(CharacteristicError):
    pass


class CharacteristicNotFoundError(CharacteristicError):
    pass


class CharacteristicRuleError(CharacteristicError):
    pass


SYSTEM_DEFINITIONS = (
    ("color", "Цвет", "COLOR", True),
    ("size", "Размер", "LIST", True),
)


def _definition(db: Session, characteristic_id: int) -> CharacteristicDefinition:
    item = db.get(CharacteristicDefinition, characteristic_id)
    if item is None:
        raise CharacteristicNotFoundError("Characteristic not found")
    return item


def _validate_unit(db: Session, unit_id: int | None) -> None:
    if unit_id is not None and db.get(UnitOfMeasure, unit_id) is None:
        raise CharacteristicRuleError("Единица измерения не найдена")


def _assert_unique_name(
    db: Session, name: str, *, exclude_id: int | None = None
) -> None:
    statement = select(CharacteristicDefinition.id).where(
        func.lower(CharacteristicDefinition.name) == name.casefold()
    )
    if exclude_id is not None:
        statement = statement.where(CharacteristicDefinition.id != exclude_id)
    if db.scalar(statement) is not None:
        raise CharacteristicConflictError("Характеристика с таким названием уже существует")


def list_definitions(
    db: Session,
    *,
    search: str | None = None,
    kind: str | None = None,
    is_active: bool | None = None,
) -> list[CharacteristicDefinition]:
    _ensure_system_definitions(db)
    statement = select(CharacteristicDefinition)
    if kind is not None:
        statement = statement.where(CharacteristicDefinition.kind == kind)
    if is_active is not None:
        statement = statement.where(CharacteristicDefinition.is_active == is_active)
    rows = list(
        db.scalars(
            statement.order_by(
                CharacteristicDefinition.is_active.desc(),
                func.lower(CharacteristicDefinition.name),
                CharacteristicDefinition.id,
            )
        ).all()
    )
    if search and search.strip():
        needle = search.strip().casefold()
        rows = [
            row
            for row in rows
            if needle in row.code.casefold() or needle in row.name.casefold()
        ]
    return rows


def _ensure_system_definitions(db: Session) -> None:
    changed = False
    for code, name, kind, is_variant in SYSTEM_DEFINITIONS:
        item = db.scalar(
            select(CharacteristicDefinition).where(CharacteristicDefinition.code == code)
        )
        if item is None:
            db.add(
                CharacteristicDefinition(
                    code=code,
                    name=name,
                    kind=kind,
                    is_variant_dimension=is_variant,
                    is_system=True,
                    is_active=True,
                )
            )
            changed = True
        else:
            if not item.is_variant_dimension or not item.is_system:
                item.is_variant_dimension = is_variant
                item.is_system = True
                changed = True
    if changed:
        db.commit()
    from app.services.characteristic_colors_seed import seed_standard_color_options

    seed_standard_color_options(db)
    db.commit()


def create_definition(
    db: Session, payload: CharacteristicDefinitionCreate
) -> CharacteristicDefinition:
    _validate_unit(db, payload.unit_id)
    _assert_unique_name(db, payload.name)
    if payload.is_variant_dimension and payload.kind not in VARIANT_KINDS:
        raise CharacteristicRuleError(
            "Измерение варианта доступно только для типов LIST и COLOR"
        )
    data = payload.model_dump()
    code = data.get("code")
    if not code:
        base = re.sub(r"[^a-z0-9]+", "_", payload.name.casefold()).strip("_") or "characteristic"
        code = base[:90]
        suffix = 2
        while db.scalar(
            select(CharacteristicDefinition.id).where(CharacteristicDefinition.code == code)
        ) is not None:
            code = f"{base[: max(1, 99 - len(str(suffix)))]}_{suffix}"
            suffix += 1
        data["code"] = code
    elif db.scalar(
        select(CharacteristicDefinition.id).where(CharacteristicDefinition.code == code)
    ) is not None:
        raise CharacteristicConflictError("Characteristic code already exists")
    item = CharacteristicDefinition(**data, is_system=False)
    db.add(item)
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise CharacteristicConflictError(
            "Характеристика с таким кодом или названием уже существует"
        ) from error
    db.refresh(item)
    return item


def update_definition(
    db: Session, characteristic_id: int, payload: CharacteristicDefinitionUpdate
) -> CharacteristicDefinition:
    item = _definition(db, characteristic_id)
    changes = payload.model_dump(exclude_unset=True)
    _validate_unit(db, changes.get("unit_id", item.unit_id))
    if "name" in changes and changes["name"] is not None:
        _assert_unique_name(db, changes["name"], exclude_id=characteristic_id)
    for key, value in changes.items():
        setattr(item, key, value)
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise CharacteristicConflictError("Не удалось обновить характеристику") from error
    db.refresh(item)
    return item


def definition_usage_blocks(db: Session, characteristic_id: int) -> list[str]:
    blocks: list[str] = []
    if characteristic_has_journal_operations(db, characteristic_id):
        blocks.append("journal")
    if db.scalar(
        select(CategoryCharacteristic.id).where(
            CategoryCharacteristic.characteristic_id == characteristic_id
        ).limit(1)
    ):
        blocks.append("category")
    if db.scalar(
        select(NomenclatureCharacteristic.id).where(
            NomenclatureCharacteristic.characteristic_id == characteristic_id
        ).limit(1)
    ):
        blocks.append("nomenclature_assignment")
    if db.scalar(
        select(NomenclatureCharacteristicValue.id).where(
            NomenclatureCharacteristicValue.characteristic_id == characteristic_id
        ).limit(1)
    ):
        blocks.append("nomenclature_value")
    return blocks


def option_usage_blocks(db: Session, option_id: int) -> list[str]:
    blocks: list[str] = []
    if characteristic_option_has_journal_operations(db, option_id):
        blocks.append("journal")
    if db.scalar(
        select(variant_options.c.variant_id).where(
            variant_options.c.option_id == option_id
        ).limit(1)
    ):
        blocks.append("variant")
    if db.scalar(
        select(NomenclatureCharacteristicValue.id).where(
            NomenclatureCharacteristicValue.option_id == option_id
        ).limit(1)
    ):
        blocks.append("nomenclature_value")
    if db.scalar(
        select(nomenclature_characteristic_value_options.c.value_id).where(
            nomenclature_characteristic_value_options.c.option_id == option_id
        ).limit(1)
    ):
        blocks.append("nomenclature_value_multi")
    if db.scalar(
        select(CategoryCharacteristic.id).where(
            CategoryCharacteristic.default_option_id == option_id
        ).limit(1)
    ):
        blocks.append("category_default")
    return blocks


def can_delete_definition(db: Session, characteristic_id: int) -> bool:
    item = _definition(db, characteristic_id)
    if item.is_system:
        return False
    return not definition_usage_blocks(db, characteristic_id)


def can_delete_option(db: Session, option_id: int) -> bool:
    return not option_usage_blocks(db, option_id)


def delete_definition(db: Session, characteristic_id: int) -> None:
    item = _definition(db, characteristic_id)
    if item.is_system:
        raise CharacteristicConflictError("Системную характеристику нельзя удалить")
    blocks = definition_usage_blocks(db, characteristic_id)
    if blocks:
        raise CharacteristicConflictError(
            "Характеристику нельзя удалить: есть использование или проводки"
        )
    db.delete(item)
    db.commit()


def list_options(db: Session, characteristic_id: int) -> list[CharacteristicOption]:
    definition = _definition(db, characteristic_id)
    if definition.code == "color":
        from app.services.characteristic_colors_seed import seed_standard_color_options

        seed_standard_color_options(db)
        db.commit()
    return list(
        db.scalars(
            select(CharacteristicOption)
            .where(CharacteristicOption.characteristic_id == characteristic_id)
            .order_by(CharacteristicOption.sort_order, CharacteristicOption.id)
        ).all()
    )


def list_used_value_labels(
    db: Session,
    characteristic_id: int,
    *,
    limit: int = 30,
) -> list[str]:
    """Distinct free-text / option labels already used on nomenclature cards."""
    definition = _definition(db, characteristic_id)
    labels: list[str] = []
    seen: set[str] = set()

    def add(raw: object | None) -> None:
        if raw is None:
            return
        text = str(raw).strip()
        if not text:
            return
        key = text.casefold()
        if key in seen:
            return
        seen.add(key)
        labels.append(text)

    if definition.kind in OPTION_KINDS:
        for option in list_options(db, characteristic_id):
            if option.is_active:
                add(option.label)
        return labels[:limit]

    rows = db.scalars(
        select(NomenclatureCharacteristicValue).where(
            NomenclatureCharacteristicValue.characteristic_id == characteristic_id
        )
    ).all()
    for row in rows:
        if definition.kind in ("STRING", "TEXT", "COLOR"):
            add(row.string_value)
        elif definition.kind == "INTEGER" and row.integer_value is not None:
            add(row.integer_value)
        elif definition.kind == "DECIMAL" and row.decimal_value is not None:
            add(row.decimal_value)
        elif definition.kind == "BOOLEAN" and row.boolean_value is not None:
            add("true" if row.boolean_value else "false")
        elif definition.kind == "DATE" and row.date_value is not None:
            add(row.date_value.isoformat())
    return labels[:limit]


def create_option(
    db: Session, characteristic_id: int, payload: CharacteristicOptionCreate
) -> CharacteristicOption:
    definition = _definition(db, characteristic_id)
    if definition.kind not in OPTION_KINDS:
        raise CharacteristicRuleError("Значения доступны только для LIST, MULTI_SELECT и COLOR")
    if definition.kind == "COLOR" and payload.hex_value is None:
        raise CharacteristicRuleError("Color option HEX is required")
    if definition.kind != "COLOR" and payload.hex_value is not None:
        raise CharacteristicRuleError("HEX is available only for color characteristics")
    if db.scalar(
        select(CharacteristicOption).where(
            CharacteristicOption.characteristic_id == characteristic_id,
            CharacteristicOption.code == payload.code,
        )
    ):
        raise CharacteristicConflictError("Characteristic option code already exists")
    data = payload.model_dump()
    if data.get("hex_value"):
        data["hex_value"] = str(data["hex_value"]).upper()
    item = CharacteristicOption(characteristic_id=characteristic_id, **data)
    db.add(item)
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise CharacteristicConflictError("Characteristic option code already exists") from error
    db.refresh(item)
    return item


def update_option(
    db: Session, option_id: int, payload: CharacteristicOptionUpdate
) -> CharacteristicOption:
    item = db.get(CharacteristicOption, option_id)
    if item is None:
        raise CharacteristicNotFoundError("Characteristic option not found")
    definition = _definition(db, item.characteristic_id)
    changes = payload.model_dump(exclude_unset=True)
    if definition.kind == "COLOR" and "hex_value" in changes and changes["hex_value"] is None:
        raise CharacteristicRuleError("Color option HEX is required")
    if definition.kind != "COLOR" and changes.get("hex_value") is not None:
        raise CharacteristicRuleError("HEX is available only for color characteristics")
    if changes.get("hex_value"):
        changes["hex_value"] = str(changes["hex_value"]).upper()
    for key, value in changes.items():
        setattr(item, key, value)
    db.commit()
    db.refresh(item)
    return item


def delete_option(db: Session, option_id: int) -> None:
    item = db.get(CharacteristicOption, option_id)
    if item is None:
        raise CharacteristicNotFoundError("Characteristic option not found")
    blocks = option_usage_blocks(db, option_id)
    if blocks:
        raise CharacteristicConflictError(
            "Значение нельзя удалить: есть использование или проводки"
        )
    db.delete(item)
    db.commit()


def _category_chain(db: Session, category_id: int) -> list[NomenclatureCategory]:
    result: list[NomenclatureCategory] = []
    current = db.get(NomenclatureCategory, category_id)
    seen: set[int] = set()
    if current is None:
        raise CharacteristicNotFoundError("Category not found")
    while current:
        if current.id in seen:
            raise CharacteristicRuleError("Category hierarchy contains a cycle")
        seen.add(current.id)
        result.append(current)
        current = (
            db.get(NomenclatureCategory, current.parent_id) if current.parent_id else None
        )
    return list(reversed(result))


def effective_category_characteristics(
    db: Session, category_id: int
) -> list[tuple[CategoryCharacteristic, int, bool]]:
    selected: dict[int, tuple[CategoryCharacteristic, int, bool]] = {}
    for category in _category_chain(db, category_id):
        rows = db.scalars(
            select(CategoryCharacteristic)
            .where(CategoryCharacteristic.category_id == category.id)
            .order_by(CategoryCharacteristic.sort_order, CategoryCharacteristic.id)
        ).all()
        for row in rows:
            if category.id != category_id and not row.inherit:
                continue
            if (
                row.characteristic_id not in selected
                or category.id == category_id
                or selected[row.characteristic_id][0].inherit
            ):
                selected[row.characteristic_id] = (
                    row,
                    category.id,
                    category.id != category_id,
                )
    return list(selected.values())


def list_category_characteristics(
    db: Session, category_id: int
) -> list[tuple[CategoryCharacteristic, int, bool]]:
    return effective_category_characteristics(db, category_id)


def _clear_default(assignment: CategoryCharacteristic) -> None:
    assignment.default_string_value = None
    assignment.default_integer_value = None
    assignment.default_decimal_value = None
    assignment.default_boolean_value = None
    assignment.default_date_value = None
    assignment.default_option_id = None
    assignment.default_options = []


def _write_default(
    assignment: CategoryCharacteristic,
    definition: CharacteristicDefinition,
    value: object | None,
    db: Session,
) -> None:
    if value is None:
        return
    if definition.kind in ("STRING", "TEXT", "COLOR") and not definition.is_variant_dimension:
        # COLOR as attribute may store free HEX; LIST-like COLOR variant dims use options
        if definition.kind == "COLOR" and definition.is_variant_dimension:
            assignment.default_option_id = int(value)
        else:
            assignment.default_string_value = str(value)
    elif definition.kind in ("STRING", "TEXT"):
        assignment.default_string_value = str(value)
    elif definition.kind == "INTEGER":
        assignment.default_integer_value = int(value)
    elif definition.kind == "DECIMAL":
        assignment.default_decimal_value = Decimal(str(value))
    elif definition.kind == "BOOLEAN":
        assignment.default_boolean_value = bool(value)
    elif definition.kind == "DATE":
        assignment.default_date_value = date.fromisoformat(str(value))
    elif definition.kind == "LIST":
        assignment.default_option_id = int(value)
    elif definition.kind == "COLOR" and definition.is_variant_dimension:
        assignment.default_option_id = int(value)
    elif definition.kind == "COLOR":
        assignment.default_string_value = str(value)
    elif definition.kind == "MULTI_SELECT":
        assignment.default_options = list(
            db.scalars(
                select(CharacteristicOption).where(CharacteristicOption.id.in_(value))
            ).all()
        )


def _default_value(
    assignment: CategoryCharacteristic, definition: CharacteristicDefinition
) -> object | None:
    if definition.kind == "MULTI_SELECT":
        return [option.id for option in assignment.default_options]
    if definition.kind == "LIST" or (
        definition.kind == "COLOR" and definition.is_variant_dimension
    ):
        return assignment.default_option_id
    if definition.kind in ("STRING", "TEXT") or (
        definition.kind == "COLOR" and not definition.is_variant_dimension
    ):
        return assignment.default_string_value
    return {
        "INTEGER": assignment.default_integer_value,
        "DECIMAL": assignment.default_decimal_value,
        "BOOLEAN": assignment.default_boolean_value,
        "DATE": assignment.default_date_value,
    }.get(definition.kind)


def _validate_value(
    db: Session, definition: CharacteristicDefinition, value: object | None
) -> None:
    if value is None:
        return
    try:
        if definition.kind in ("STRING", "TEXT") and not isinstance(value, str):
            raise ValueError
        if definition.kind == "COLOR" and not definition.is_variant_dimension:
            if not isinstance(value, str) or re.fullmatch(r"#[0-9A-Fa-f]{6}", value) is None:
                raise ValueError
        if definition.kind == "INTEGER" and (isinstance(value, bool) or int(value) != value):
            raise ValueError
        if definition.kind == "DECIMAL":
            Decimal(str(value))
        if definition.kind == "BOOLEAN" and not isinstance(value, bool):
            raise ValueError
        if definition.kind == "DATE":
            date.fromisoformat(str(value))
        if definition.kind == "LIST" or (
            definition.kind == "COLOR" and definition.is_variant_dimension
        ):
            option = db.get(CharacteristicOption, int(value))
            if (
                option is None
                or option.characteristic_id != definition.id
                or not option.is_active
            ):
                raise ValueError
        if definition.kind == "MULTI_SELECT":
            if not isinstance(value, list) or any(
                not isinstance(option_id, int) for option_id in value
            ):
                raise ValueError
            options = db.scalars(
                select(CharacteristicOption).where(
                    CharacteristicOption.id.in_(value),
                    CharacteristicOption.characteristic_id == definition.id,
                    CharacteristicOption.is_active.is_(True),
                )
            ).all()
            if len(options) != len(set(value)):
                raise ValueError
    except (ValueError, TypeError, InvalidOperation):
        raise CharacteristicRuleError(
            f"Значение характеристики {definition.code} не соответствует типу"
        ) from None


def assign_category_characteristic(
    db: Session, category_id: int, payload: CategoryCharacteristicCreate
) -> CategoryCharacteristic:
    _category_chain(db, category_id)
    definition = _definition(db, payload.characteristic_id)
    if not definition.is_active:
        raise CharacteristicRuleError("Нельзя назначить неактивную характеристику")
    _validate_value(db, definition, payload.default_value)
    if db.scalar(
        select(CategoryCharacteristic).where(
            CategoryCharacteristic.category_id == category_id,
            CategoryCharacteristic.characteristic_id == payload.characteristic_id,
        )
    ):
        raise CharacteristicConflictError("Characteristic already assigned to category")
    item = CategoryCharacteristic(
        category_id=category_id,
        characteristic_id=payload.characteristic_id,
        is_required=payload.is_required,
        inherit=payload.inherit,
        is_visible=payload.is_visible,
        sort_order=payload.sort_order,
    )
    _write_default(item, definition, payload.default_value, db)
    db.add(item)
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise CharacteristicConflictError(
            "Characteristic already assigned to category"
        ) from error
    db.refresh(item)
    return item


def update_category_characteristic(
    db: Session,
    category_id: int,
    characteristic_id: int,
    payload: CategoryCharacteristicUpdate,
) -> CategoryCharacteristic:
    assignment = db.scalar(
        select(CategoryCharacteristic).where(
            CategoryCharacteristic.category_id == category_id,
            CategoryCharacteristic.characteristic_id == characteristic_id,
        )
    )
    if assignment is None:
        raise CharacteristicNotFoundError("Category characteristic assignment not found")
    definition = _definition(db, characteristic_id)
    changes = payload.model_dump(exclude_unset=True)
    if "default_value" in changes:
        _validate_value(db, definition, changes["default_value"])
        _clear_default(assignment)
        _write_default(assignment, definition, changes.pop("default_value"), db)
    for name, value in changes.items():
        setattr(assignment, name, value)
    db.commit()
    db.refresh(assignment)
    return assignment


def remove_category_characteristic(
    db: Session, category_id: int, characteristic_id: int
) -> None:
    assignment = db.scalar(
        select(CategoryCharacteristic).where(
            CategoryCharacteristic.category_id == category_id,
            CategoryCharacteristic.characteristic_id == characteristic_id,
        )
    )
    if assignment is None:
        raise CharacteristicNotFoundError("Category characteristic assignment not found")
    db.delete(assignment)
    db.commit()


def assign_nomenclature_characteristic(
    db: Session, nomenclature_id: int, payload: NomenclatureCharacteristicCreate
) -> NomenclatureCharacteristic:
    nomenclature = db.get(Nomenclature, nomenclature_id)
    if nomenclature is None:
        raise CharacteristicNotFoundError("Nomenclature not found")
    definition = _definition(db, payload.characteristic_id)
    if not definition.is_variant_dimension:
        raise CharacteristicRuleError(
            "Только измерения варианта назначаются через nomenclature characteristics"
        )
    allowed = (
        {
            row.characteristic_id
            for row, _, _ in effective_category_characteristics(db, nomenclature.category_id)
        }
        if nomenclature.category_id
        else set()
    )
    if payload.characteristic_id not in allowed:
        raise CharacteristicRuleError(
            "Characteristic is not assigned to nomenclature category"
        )
    if db.scalar(
        select(NomenclatureCharacteristic).where(
            NomenclatureCharacteristic.nomenclature_id == nomenclature_id,
            NomenclatureCharacteristic.characteristic_id == payload.characteristic_id,
        )
    ):
        raise CharacteristicConflictError(
            "Characteristic already assigned to nomenclature"
        )
    item = NomenclatureCharacteristic(
        nomenclature_id=nomenclature_id, characteristic_id=payload.characteristic_id
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def list_nomenclature_characteristics(
    db: Session, nomenclature_id: int
) -> list[NomenclatureCharacteristic]:
    if db.get(Nomenclature, nomenclature_id) is None:
        raise CharacteristicNotFoundError("Nomenclature not found")
    return list(
        db.scalars(
            select(NomenclatureCharacteristic)
            .where(NomenclatureCharacteristic.nomenclature_id == nomenclature_id)
            .order_by(NomenclatureCharacteristic.id)
        ).all()
    )


def _set_value(
    value_row: NomenclatureCharacteristicValue,
    definition: CharacteristicDefinition,
    raw: object | None,
) -> None:
    value_row.string_value = None
    value_row.integer_value = None
    value_row.decimal_value = None
    value_row.boolean_value = None
    value_row.date_value = None
    value_row.option_id = None
    if raw is None:
        return
    if definition.kind in ("STRING", "TEXT") or (
        definition.kind == "COLOR" and not definition.is_variant_dimension
    ):
        value_row.string_value = str(raw)
    elif definition.kind == "INTEGER":
        value_row.integer_value = int(raw)
    elif definition.kind == "DECIMAL":
        value_row.decimal_value = Decimal(str(raw))
    elif definition.kind == "BOOLEAN":
        value_row.boolean_value = bool(raw)
    elif definition.kind == "DATE":
        value_row.date_value = date.fromisoformat(str(raw))
    elif definition.kind == "LIST" or (
        definition.kind == "COLOR" and definition.is_variant_dimension
    ):
        value_row.option_id = int(raw)
    elif definition.kind == "MULTI_SELECT":
        value_row.options = []


def _stored_value(
    row: NomenclatureCharacteristicValue | None, definition: CharacteristicDefinition
) -> object | None:
    if row is None:
        return None
    if definition.kind in ("STRING", "TEXT") or (
        definition.kind == "COLOR" and not definition.is_variant_dimension
    ):
        return row.string_value
    if definition.kind == "INTEGER":
        return row.integer_value
    if definition.kind == "DECIMAL":
        return row.decimal_value
    if definition.kind == "BOOLEAN":
        return row.boolean_value
    if definition.kind == "DATE":
        return row.date_value
    if definition.kind == "LIST" or (
        definition.kind == "COLOR" and definition.is_variant_dimension
    ):
        return row.option_id
    return [option.id for option in row.options]


def get_nomenclature_values(
    db: Session, nomenclature_id: int
) -> list[
    tuple[
        CategoryCharacteristic | SimpleNamespace,
        CharacteristicDefinition,
        NomenclatureCharacteristicValue | None,
        int | None,
        bool,
    ]
]:
    nomenclature = db.get(Nomenclature, nomenclature_id)
    if nomenclature is None:
        raise CharacteristicNotFoundError("Nomenclature not found")
    rows = {
        row.characteristic_id: row
        for row in db.scalars(
            select(NomenclatureCharacteristicValue).where(
                NomenclatureCharacteristicValue.nomenclature_id == nomenclature_id
            )
        ).all()
    }
    effective = (
        effective_category_characteristics(db, nomenclature.category_id)
        if nomenclature.category_id is not None
        else []
    )
    result: list[
        tuple[
            CategoryCharacteristic | SimpleNamespace,
            CharacteristicDefinition,
            NomenclatureCharacteristicValue | None,
            int | None,
            bool,
        ]
    ] = []
    for assignment, source_id, inherited in effective:
        definition = _definition(db, assignment.characteristic_id)
        if definition.is_variant_dimension:
            # Variant dimensions from category stay in the variants block only.
            continue
        result.append(
            (
                assignment,
                definition,
                rows.pop(definition.id, None),
                source_id,
                inherited,
            )
        )
    for characteristic_id, row in rows.items():
        definition = _definition(db, characteristic_id)
        # Direct card assignments may include any handbook definition (incl. COLOR/LIST
        # also used as variant dimensions elsewhere).
        result.append(
            (SimpleNamespace(is_required=False, is_visible=True), definition, row, None, False)
        )
    return result


def assign_nomenclature_value(
    db: Session,
    nomenclature_id: int,
    payload: NomenclatureCharacteristicAssignmentInput,
) -> list[
    tuple[
        CategoryCharacteristic | SimpleNamespace,
        CharacteristicDefinition,
        NomenclatureCharacteristicValue | None,
        int | None,
        bool,
    ]
]:
    nomenclature = db.get(Nomenclature, nomenclature_id)
    if nomenclature is None:
        raise CharacteristicNotFoundError("Nomenclature not found")
    definition = _definition(db, payload.characteristic_id)
    if not definition.is_active:
        raise CharacteristicRuleError("Нельзя назначить неактивную характеристику")
    if any(item[1].id == definition.id for item in get_nomenclature_values(db, nomenclature_id)):
        raise CharacteristicConflictError(
            "Характеристика уже назначена номенклатуре или её категории"
        )
    db.add(
        NomenclatureCharacteristicValue(
            nomenclature_id=nomenclature_id, characteristic_id=definition.id
        )
    )
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise CharacteristicConflictError(
            "Характеристика уже назначена номенклатуре"
        ) from error
    return get_nomenclature_values(db, nomenclature_id)


def remove_nomenclature_value(
    db: Session, nomenclature_id: int, characteristic_id: int
) -> None:
    rows = get_nomenclature_values(db, nomenclature_id)
    if any(
        definition.id == characteristic_id and source_id is not None
        for _, definition, _, source_id, _ in rows
    ):
        raise CharacteristicRuleError(
            "Характеристика назначена категорией и не может быть удалена из карточки"
        )
    row = db.scalar(
        select(NomenclatureCharacteristicValue).where(
            NomenclatureCharacteristicValue.nomenclature_id == nomenclature_id,
            NomenclatureCharacteristicValue.characteristic_id == characteristic_id,
        )
    )
    if row is None:
        raise CharacteristicNotFoundError("Назначение характеристики не найдено")
    db.delete(row)
    db.commit()


def save_nomenclature_values(
    db: Session,
    nomenclature_id: int,
    payload: list[NomenclatureCharacteristicValueInput],
) -> list[
    tuple[
        CategoryCharacteristic | SimpleNamespace,
        CharacteristicDefinition,
        NomenclatureCharacteristicValue | None,
        int | None,
        bool,
    ]
]:
    rows = get_nomenclature_values(db, nomenclature_id)
    available = {definition.id: (assignment, definition) for assignment, definition, _, _, _ in rows}
    supplied = {item.characteristic_id: item.value for item in payload}
    if len(supplied) != len(payload):
        raise CharacteristicRuleError("Характеристика указана более одного раза")
    for characteristic_id, value in supplied.items():
        if characteristic_id not in available:
            raise CharacteristicRuleError("Характеристика не назначена номенклатуре")
        _validate_value(db, available[characteristic_id][1], value)
    for assignment, definition, row, source_id, _ in rows:
        value = supplied.get(definition.id, _stored_value(row, definition))
        if (
            value is None
            and getattr(assignment, "is_required", False)
            and _default_value(assignment, definition) is None  # type: ignore[arg-type]
        ):
            raise CharacteristicRuleError(
                f"Обязательная характеристика {definition.name} не заполнена"
            )
        if definition.id not in supplied:
            continue
        if value is None and source_id is not None:
            if row is not None:
                db.delete(row)
            continue
        if row is None and value is None:
            continue
        if row is None:
            row = NomenclatureCharacteristicValue(
                nomenclature_id=nomenclature_id, characteristic_id=definition.id
            )
            db.add(row)
        _set_value(row, definition, value)
        if definition.kind == "MULTI_SELECT" and value is not None:
            row.options = list(
                db.scalars(
                    select(CharacteristicOption).where(CharacteristicOption.id.in_(value))
                ).all()
            )
    db.commit()
    return get_nomenclature_values(db, nomenclature_id)


def _option_rows(db: Session, option_ids: list[int]) -> list[CharacteristicOption]:
    if len(set(option_ids)) != len(option_ids):
        raise CharacteristicRuleError("Variant contains duplicate options")
    rows = list(
        db.scalars(select(CharacteristicOption).where(CharacteristicOption.id.in_(option_ids))).all()
    )
    if len(rows) != len(option_ids) or any(not row.is_active for row in rows):
        raise CharacteristicRuleError("Variant contains unknown or inactive option")
    return rows


def _variant_dimension_ids(db: Session, nomenclature_id: int) -> set[int]:
    assigned = {
        row.characteristic_id
        for row in list_nomenclature_characteristics(db, nomenclature_id)
    }
    if assigned:
        return {
            characteristic_id
            for characteristic_id in assigned
            if _definition(db, characteristic_id).is_variant_dimension
        }
    nomenclature = db.get(Nomenclature, nomenclature_id)
    if nomenclature is None or nomenclature.category_id is None:
        return set()
    return {
        row.characteristic_id
        for row, _, _ in effective_category_characteristics(db, nomenclature.category_id)
        if _definition(db, row.characteristic_id).is_variant_dimension
    }


def _validate_variant(
    db: Session,
    nomenclature_id: int,
    option_ids: list[int],
    variant_id: int | None = None,
) -> list[CharacteristicOption]:
    if db.get(Nomenclature, nomenclature_id) is None:
        raise CharacteristicNotFoundError("Nomenclature not found")
    allowed = _variant_dimension_ids(db, nomenclature_id)
    rows = _option_rows(db, option_ids)
    if {row.characteristic_id for row in rows} != allowed:
        raise CharacteristicRuleError(
            "Variant must contain exactly one value for every assigned characteristic"
        )
    existing = db.scalars(
        select(NomenclatureVariant).where(
            NomenclatureVariant.nomenclature_id == nomenclature_id
        )
    ).all()
    target = frozenset(option_ids)
    for variant in existing:
        if variant.id == variant_id:
            continue
        ids = frozenset(
            db.scalars(
                select(variant_options.c.option_id).where(
                    variant_options.c.variant_id == variant.id
                )
            ).all()
        )
        if ids == target:
            raise CharacteristicConflictError("Duplicate variant combination")
    return rows


def _variant_read_options(
    db: Session, variant: NomenclatureVariant
) -> list[CharacteristicOption]:
    return list(
        db.scalars(
            select(CharacteristicOption)
            .join(variant_options, variant_options.c.option_id == CharacteristicOption.id)
            .where(variant_options.c.variant_id == variant.id)
            .order_by(
                CharacteristicOption.characteristic_id, CharacteristicOption.sort_order
            )
        ).all()
    )


def list_variants(
    db: Session, nomenclature_id: int
) -> list[tuple[NomenclatureVariant, list[CharacteristicOption]]]:
    if db.get(Nomenclature, nomenclature_id) is None:
        raise CharacteristicNotFoundError("Nomenclature not found")
    return [
        (variant, _variant_read_options(db, variant))
        for variant in db.scalars(
            select(NomenclatureVariant)
            .where(NomenclatureVariant.nomenclature_id == nomenclature_id)
            .order_by(NomenclatureVariant.article, NomenclatureVariant.id)
        ).all()
    ]


def create_variant(
    db: Session, nomenclature_id: int, payload: VariantCreate
) -> NomenclatureVariant:
    rows = _validate_variant(db, nomenclature_id, payload.option_ids)
    if db.scalar(
        select(NomenclatureVariant).where(NomenclatureVariant.article == payload.article)
    ):
        raise CharacteristicConflictError("Variant article already exists")
    item = NomenclatureVariant(
        nomenclature_id=nomenclature_id, article=payload.article, name=payload.name
    )
    db.add(item)
    db.flush()
    db.execute(
        variant_options.insert(),
        [{"variant_id": item.id, "option_id": row.id} for row in rows],
    )
    db.commit()
    db.refresh(item)
    return item


def update_variant(db: Session, variant_id: int, payload: VariantUpdate) -> NomenclatureVariant:
    item = db.get(NomenclatureVariant, variant_id)
    if item is None:
        raise CharacteristicNotFoundError("Variant not found")
    changes = payload.model_dump(exclude_unset=True)
    option_ids = changes.pop("option_ids", None)
    if "article" in changes and db.scalar(
        select(NomenclatureVariant).where(
            NomenclatureVariant.article == changes["article"],
            NomenclatureVariant.id != variant_id,
        )
    ):
        raise CharacteristicConflictError("Variant article already exists")
    if option_ids is not None:
        rows = _validate_variant(db, item.nomenclature_id, option_ids, item.id)
        db.execute(variant_options.delete().where(variant_options.c.variant_id == item.id))
        db.execute(
            variant_options.insert(),
            [{"variant_id": item.id, "option_id": row.id} for row in rows],
        )
    for key, value in changes.items():
        setattr(item, key, value)
    db.commit()
    db.refresh(item)
    return item


def generate_variants(
    db: Session, nomenclature_id: int, payload: VariantGenerateRequest
) -> list[NomenclatureVariant]:
    characteristic_ids = sorted(_variant_dimension_ids(db, nomenclature_id))
    option_groups = [list_options(db, characteristic_id) for characteristic_id in characteristic_ids]
    if not option_groups or any(not group for group in option_groups):
        raise CharacteristicRuleError("Every characteristic must have active options")
    created: list[NomenclatureVariant] = []
    for index, combination in enumerate(product(*option_groups), start=1):
        option_ids = [option.id for option in combination]
        article = f"{payload.article_prefix}-{index}"
        if db.scalar(
            select(NomenclatureVariant).where(NomenclatureVariant.article == article)
        ):
            continue
        try:
            created.append(
                create_variant(
                    db,
                    nomenclature_id,
                    VariantCreate(
                        article=article,
                        name=" / ".join(option.label for option in combination),
                        option_ids=option_ids,
                    ),
                )
            )
        except CharacteristicConflictError as error:
            if "Duplicate variant" not in str(error):
                raise
    return created


def variant_snapshot_rows(db: Session, variant_id: int) -> list[dict[str, object]]:
    variant = db.get(NomenclatureVariant, variant_id)
    if variant is None:
        raise CharacteristicNotFoundError("Variant not found")
    return [
        {
            "characteristic_id": option.characteristic_id,
            "characteristic_code": definition.code,
            "characteristic_name": definition.name,
            "option_id": option.id,
            "option_code": option.code,
            "option_label": option.label,
        }
        for option, definition in db.execute(
            select(CharacteristicOption, CharacteristicDefinition)
            .join(
                CharacteristicDefinition,
                CharacteristicDefinition.id == CharacteristicOption.characteristic_id,
            )
            .join(
                variant_options, variant_options.c.option_id == CharacteristicOption.id
            )
            .where(variant_options.c.variant_id == variant_id)
        ).all()
    ]


def value_read_payload(
    assignment: CategoryCharacteristic | SimpleNamespace,
    definition: CharacteristicDefinition,
    row: NomenclatureCharacteristicValue | None,
    source_id: int | None,
    inherited: bool,
) -> dict[str, object]:
    default = (
        _default_value(assignment, definition)  # type: ignore[arg-type]
        if isinstance(assignment, CategoryCharacteristic)
        else None
    )
    stored = _stored_value(row, definition)
    return {
        "characteristic_id": definition.id,
        "code": definition.code,
        "name": definition.name,
        "kind": definition.kind,
        "is_required": bool(getattr(assignment, "is_required", False)),
        "is_visible": bool(getattr(assignment, "is_visible", True)),
        "inherited": inherited,
        "source_category_id": source_id,
        "value": stored if stored is not None else default,
        "default_value": default,
    }
