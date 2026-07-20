from __future__ import annotations

from itertools import product

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.characteristics import CategoryCharacteristic, CharacteristicDefinition, CharacteristicOption, NomenclatureCharacteristic, NomenclatureVariant, variant_options
from app.models.nomenclature import Nomenclature, NomenclatureCategory
from app.schemas.characteristics import CategoryCharacteristicCreate, CharacteristicDefinitionCreate, CharacteristicDefinitionUpdate, CharacteristicOptionCreate, CharacteristicOptionUpdate, NomenclatureCharacteristicCreate, VariantCreate, VariantGenerateRequest, VariantUpdate


class CharacteristicError(RuntimeError):
    pass


def _definition(db: Session, characteristic_id: int) -> CharacteristicDefinition:
    item = db.get(CharacteristicDefinition, characteristic_id)
    if item is None:
        raise CharacteristicError("Characteristic not found")
    return item


def list_definitions(db: Session) -> list[CharacteristicDefinition]:
    return list(db.scalars(select(CharacteristicDefinition).order_by(CharacteristicDefinition.name, CharacteristicDefinition.id)).all())


def create_definition(db: Session, payload: CharacteristicDefinitionCreate) -> CharacteristicDefinition:
    if db.scalar(select(CharacteristicDefinition).where(CharacteristicDefinition.code == payload.code)):
        raise CharacteristicError("Characteristic code already exists")
    item = CharacteristicDefinition(**payload.model_dump())
    db.add(item); db.commit(); db.refresh(item); return item


def update_definition(db: Session, characteristic_id: int, payload: CharacteristicDefinitionUpdate) -> CharacteristicDefinition:
    item = _definition(db, characteristic_id)
    for key, value in payload.model_dump(exclude_unset=True).items(): setattr(item, key, value)
    db.commit(); db.refresh(item); return item


def list_options(db: Session, characteristic_id: int) -> list[CharacteristicOption]:
    _definition(db, characteristic_id)
    return list(db.scalars(select(CharacteristicOption).where(CharacteristicOption.characteristic_id == characteristic_id).order_by(CharacteristicOption.sort_order, CharacteristicOption.id)).all())


def create_option(db: Session, characteristic_id: int, payload: CharacteristicOptionCreate) -> CharacteristicOption:
    _definition(db, characteristic_id)
    if db.scalar(select(CharacteristicOption).where(CharacteristicOption.characteristic_id == characteristic_id, CharacteristicOption.code == payload.code)):
        raise CharacteristicError("Characteristic option code already exists")
    item = CharacteristicOption(characteristic_id=characteristic_id, **payload.model_dump())
    db.add(item); db.commit(); db.refresh(item); return item


def update_option(db: Session, option_id: int, payload: CharacteristicOptionUpdate) -> CharacteristicOption:
    item = db.get(CharacteristicOption, option_id)
    if item is None: raise CharacteristicError("Characteristic option not found")
    for key, value in payload.model_dump(exclude_unset=True).items(): setattr(item, key, value)
    db.commit(); db.refresh(item); return item


def _category_chain(db: Session, category_id: int) -> list[NomenclatureCategory]:
    result: list[NomenclatureCategory] = []; current = db.get(NomenclatureCategory, category_id); seen: set[int] = set()
    if current is None: raise CharacteristicError("Category not found")
    while current:
        if current.id in seen: raise CharacteristicError("Category hierarchy contains a cycle")
        seen.add(current.id); result.append(current); current = db.get(NomenclatureCategory, current.parent_id) if current.parent_id else None
    return list(reversed(result))


def effective_category_characteristics(db: Session, category_id: int) -> list[tuple[CategoryCharacteristic, int, bool]]:
    selected: dict[int, tuple[CategoryCharacteristic, int, bool]] = {}
    for category in _category_chain(db, category_id):
        rows = db.scalars(select(CategoryCharacteristic).where(CategoryCharacteristic.category_id == category.id).order_by(CategoryCharacteristic.sort_order, CategoryCharacteristic.id)).all()
        for row in rows:
            if row.characteristic_id not in selected or category.id == category_id or selected[row.characteristic_id][0].inherit:
                selected[row.characteristic_id] = (row, category.id, category.id != category_id)
    return list(selected.values())


def list_category_characteristics(db: Session, category_id: int) -> list[tuple[CategoryCharacteristic, int, bool]]:
    return effective_category_characteristics(db, category_id)


def assign_category_characteristic(db: Session, category_id: int, payload: CategoryCharacteristicCreate) -> CategoryCharacteristic:
    if db.get(NomenclatureCategory, category_id) is None: raise CharacteristicError("Category not found")
    _definition(db, payload.characteristic_id)
    if db.scalar(select(CategoryCharacteristic).where(CategoryCharacteristic.category_id == category_id, CategoryCharacteristic.characteristic_id == payload.characteristic_id)):
        raise CharacteristicError("Characteristic already assigned to category")
    item = CategoryCharacteristic(category_id=category_id, **payload.model_dump()); db.add(item); db.commit(); db.refresh(item); return item


def assign_nomenclature_characteristic(db: Session, nomenclature_id: int, payload: NomenclatureCharacteristicCreate) -> NomenclatureCharacteristic:
    nomenclature = db.get(Nomenclature, nomenclature_id)
    if nomenclature is None: raise CharacteristicError("Nomenclature not found")
    _definition(db, payload.characteristic_id)
    allowed = {characteristic_id for _, characteristic_id, _ in effective_category_characteristics(db, nomenclature.category_id)} if nomenclature.category_id else set()
    if payload.characteristic_id not in allowed: raise CharacteristicError("Characteristic is not assigned to nomenclature category")
    if db.scalar(select(NomenclatureCharacteristic).where(NomenclatureCharacteristic.nomenclature_id == nomenclature_id, NomenclatureCharacteristic.characteristic_id == payload.characteristic_id)):
        raise CharacteristicError("Characteristic already assigned to nomenclature")
    item = NomenclatureCharacteristic(nomenclature_id=nomenclature_id, **payload.model_dump()); db.add(item); db.commit(); db.refresh(item); return item


def list_nomenclature_characteristics(db: Session, nomenclature_id: int) -> list[NomenclatureCharacteristic]:
    if db.get(Nomenclature, nomenclature_id) is None: raise CharacteristicError("Nomenclature not found")
    return list(db.scalars(select(NomenclatureCharacteristic).where(NomenclatureCharacteristic.nomenclature_id == nomenclature_id).order_by(NomenclatureCharacteristic.id)).all())


def _option_rows(db: Session, option_ids: list[int]) -> list[CharacteristicOption]:
    if len(set(option_ids)) != len(option_ids): raise CharacteristicError("Variant contains duplicate options")
    rows = list(db.scalars(select(CharacteristicOption).where(CharacteristicOption.id.in_(option_ids))).all())
    if len(rows) != len(option_ids) or any(not row.is_active for row in rows): raise CharacteristicError("Variant contains unknown or inactive option")
    return rows


def _validate_variant(db: Session, nomenclature_id: int, option_ids: list[int], variant_id: int | None = None) -> list[CharacteristicOption]:
    nomenclature = db.get(Nomenclature, nomenclature_id)
    if nomenclature is None: raise CharacteristicError("Nomenclature not found")
    assigned = {row.characteristic_id for row in list_nomenclature_characteristics(db, nomenclature_id)}
    effective = {characteristic_id for _, characteristic_id, _ in effective_category_characteristics(db, nomenclature.category_id)} if nomenclature.category_id else set()
    allowed = assigned or effective
    rows = _option_rows(db, option_ids)
    if {row.characteristic_id for row in rows} != allowed: raise CharacteristicError("Variant must contain exactly one value for every assigned characteristic")
    existing = db.scalars(select(NomenclatureVariant).where(NomenclatureVariant.nomenclature_id == nomenclature_id)).all()
    target = frozenset(option_ids)
    for variant in existing:
        if variant.id == variant_id: continue
        ids = frozenset(db.scalars(select(variant_options.c.option_id).where(variant_options.c.variant_id == variant.id)).all())
        if ids == target: raise CharacteristicError("Duplicate variant combination")
    return rows


def _variant_read_options(db: Session, variant: NomenclatureVariant) -> list[CharacteristicOption]:
    return list(db.scalars(select(CharacteristicOption).join(variant_options, variant_options.c.option_id == CharacteristicOption.id).where(variant_options.c.variant_id == variant.id).order_by(CharacteristicOption.characteristic_id, CharacteristicOption.sort_order)).all())


def list_variants(db: Session, nomenclature_id: int) -> list[tuple[NomenclatureVariant, list[CharacteristicOption]]]:
    if db.get(Nomenclature, nomenclature_id) is None: raise CharacteristicError("Nomenclature not found")
    return [(variant, _variant_read_options(db, variant)) for variant in db.scalars(select(NomenclatureVariant).where(NomenclatureVariant.nomenclature_id == nomenclature_id).order_by(NomenclatureVariant.article, NomenclatureVariant.id)).all()]


def create_variant(db: Session, nomenclature_id: int, payload: VariantCreate) -> NomenclatureVariant:
    rows = _validate_variant(db, nomenclature_id, payload.option_ids)
    if db.scalar(select(NomenclatureVariant).where(NomenclatureVariant.article == payload.article)): raise CharacteristicError("Variant article already exists")
    item = NomenclatureVariant(nomenclature_id=nomenclature_id, article=payload.article, name=payload.name); db.add(item); db.flush()
    db.execute(variant_options.insert(), [{"variant_id": item.id, "option_id": row.id} for row in rows]); db.commit(); db.refresh(item); return item


def update_variant(db: Session, variant_id: int, payload: VariantUpdate) -> NomenclatureVariant:
    item = db.get(NomenclatureVariant, variant_id)
    if item is None: raise CharacteristicError("Variant not found")
    changes = payload.model_dump(exclude_unset=True); option_ids = changes.pop("option_ids", None)
    if "article" in changes and db.scalar(select(NomenclatureVariant).where(NomenclatureVariant.article == changes["article"], NomenclatureVariant.id != variant_id)): raise CharacteristicError("Variant article already exists")
    if option_ids is not None: rows = _validate_variant(db, item.nomenclature_id, option_ids, item.id); db.execute(variant_options.delete().where(variant_options.c.variant_id == item.id)); db.execute(variant_options.insert(), [{"variant_id": item.id, "option_id": row.id} for row in rows])
    for key, value in changes.items(): setattr(item, key, value)
    db.commit(); db.refresh(item); return item


def generate_variants(db: Session, nomenclature_id: int, payload: VariantGenerateRequest) -> list[NomenclatureVariant]:
    characteristics = list_nomenclature_characteristics(db, nomenclature_id)
    if not characteristics:
        nomenclature = db.get(Nomenclature, nomenclature_id); characteristics = [row for row, _, _ in effective_category_characteristics(db, nomenclature.category_id)] if nomenclature and nomenclature.category_id else []
    option_groups = [list_options(db, row.characteristic_id) for row in characteristics]
    if not option_groups or any(not group for group in option_groups): raise CharacteristicError("Every characteristic must have active options")
    created: list[NomenclatureVariant] = []
    for index, combination in enumerate(product(*option_groups), start=1):
        option_ids = [option.id for option in combination]
        article = f"{payload.article_prefix}-{index}"
        if db.scalar(select(NomenclatureVariant).where(NomenclatureVariant.article == article)): continue
        try: created.append(create_variant(db, nomenclature_id, VariantCreate(article=article, name=" / ".join(option.label for option in combination), option_ids=option_ids)))
        except CharacteristicError as error:
            if "Duplicate variant" not in str(error): raise
    return created


def variant_snapshot_rows(db: Session, variant_id: int) -> list[dict[str, object]]:
    variant = db.get(NomenclatureVariant, variant_id)
    if variant is None: raise CharacteristicError("Variant not found")
    return [{"characteristic_id": option.characteristic_id, "characteristic_code": definition.code, "characteristic_name": definition.name, "option_id": option.id, "option_code": option.code, "option_label": option.label} for option, definition in db.execute(select(CharacteristicOption, CharacteristicDefinition).join(CharacteristicDefinition, CharacteristicDefinition.id == CharacteristicOption.characteristic_id).join(variant_options, variant_options.c.option_id == CharacteristicOption.id).where(variant_options.c.variant_id == variant_id)).all()]
