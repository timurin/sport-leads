from __future__ import annotations

from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload, selectinload

from app.models.characteristics import CharacteristicOption
from app.models.detailing import DetailingItem
from app.models.nomenclature import Nomenclature, NomenclatureType
from app.models.product_model import ProductModel
from app.models.product_model_material import (
    ProductModelMaterialKind,
    ProductModelMaterialLine,
)
from app.schemas.product_model_material import (
    ProductModelMaterialLineRead,
    ProductModelMaterialLineWrite,
    ProductModelMaterialLinesReplace,
)
from app.services.detailing import (
    DetailingValidationError,
    get_detailing_item,
    resolve_or_create_detailing_by_name,
)


class ModelMaterialNotFoundError(RuntimeError):
    pass


class ModelMaterialValidationError(RuntimeError):
    pass


def _line_to_read(row: ProductModelMaterialLine) -> ProductModelMaterialLineRead:
    unit = row.nomenclature.unit if row.nomenclature is not None else None
    return ProductModelMaterialLineRead(
        id=row.id,
        product_model_id=row.product_model_id,
        kind=row.kind,
        nomenclature_id=row.nomenclature_id,
        nomenclature_name=row.nomenclature.name if row.nomenclature else None,
        nomenclature_unit=unit,
        planned_qty=row.planned_qty,
        sequence=row.sequence,
        fabric_stage_code=row.fabric_stage_code,
        type_option_id=row.type_option_id,
        type_option_label=row.type_option.label if row.type_option else None,
        color_option_id=row.color_option_id,
        color_option_label=row.color_option.label if row.color_option else None,
        detailing_items=[
            {"id": item.id, "name": item.name} for item in (row.detailing_items or [])
        ],
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def list_model_material_lines(
    db: Session,
    model_id: int,
    *,
    kind: str | None = None,
) -> list[ProductModelMaterialLineRead]:
    model = db.get(ProductModel, model_id)
    if model is None:
        raise ModelMaterialNotFoundError("Модель изделия не найдена")
    statement = (
        select(ProductModelMaterialLine)
        .where(ProductModelMaterialLine.product_model_id == model_id)
        .options(
            joinedload(ProductModelMaterialLine.nomenclature),
            joinedload(ProductModelMaterialLine.type_option),
            joinedload(ProductModelMaterialLine.color_option),
            selectinload(ProductModelMaterialLine.detailing_items),
        )
        .order_by(
            ProductModelMaterialLine.kind,
            ProductModelMaterialLine.sequence,
            ProductModelMaterialLine.id,
        )
    )
    if kind:
        statement = statement.where(ProductModelMaterialLine.kind == kind)
    rows = list(db.scalars(statement).unique().all())
    return [_line_to_read(row) for row in rows]


def _assert_material_nomenclature(db: Session, nomenclature_id: int) -> Nomenclature:
    row = db.get(Nomenclature, nomenclature_id)
    if row is None:
        raise ModelMaterialValidationError("Номенклатура не найдена")
    ntype = row.nomenclature_type
    value = ntype.value if hasattr(ntype, "value") else str(ntype)
    if value != NomenclatureType.MATERIAL.value:
        raise ModelMaterialValidationError("Выберите номенклатуру типа MATERIAL")
    return row


def _assert_option(db: Session, option_id: int | None, *, expected_code: str) -> None:
    if option_id is None:
        return
    option = db.get(CharacteristicOption, option_id)
    if option is None or not option.is_active:
        raise ModelMaterialValidationError("Значение характеристики не найдено")
    definition = option.characteristic
    if definition is None:
        # lazy load
        from app.models.characteristics import CharacteristicDefinition

        definition = db.get(CharacteristicDefinition, option.characteristic_id)
    if definition is None or definition.code != expected_code:
        raise ModelMaterialValidationError(
            f"Ожидалась характеристика «{expected_code}»"
        )


def _resolve_detailings(
    db: Session,
    payload: ProductModelMaterialLineWrite,
    *,
    product_type_id: int | None,
) -> list[DetailingItem]:
    items: list[DetailingItem] = []
    seen: set[int] = set()
    for item_id in payload.detailing_item_ids:
        item = get_detailing_item(db, item_id)
        if item.id not in seen:
            items.append(item)
            seen.add(item.id)
    for name in payload.detailing_names:
        if product_type_id is None:
            raise ModelMaterialValidationError(
                "Для создания деталировки у модели должен быть вид изделия"
            )
        item = resolve_or_create_detailing_by_name(
            db,
            name=name,
            product_type_id=product_type_id,
            commit=False,
        )
        if item.id not in seen:
            items.append(item)
            seen.add(item.id)
    return items


def replace_model_material_lines(
    db: Session,
    model_id: int,
    payload: ProductModelMaterialLinesReplace,
) -> list[ProductModelMaterialLineRead]:
    model = db.get(ProductModel, model_id)
    if model is None:
        raise ModelMaterialNotFoundError("Модель изделия не найдена")

    existing = list(
        db.scalars(
            select(ProductModelMaterialLine).where(
                ProductModelMaterialLine.product_model_id == model_id
            )
        ).all()
    )
    for row in existing:
        db.delete(row)
    db.flush()

    for index, line in enumerate(payload.lines):
        _assert_material_nomenclature(db, line.nomenclature_id)
        if line.kind == ProductModelMaterialKind.HARDWARE:
            _assert_option(db, line.type_option_id, expected_code="hardware_type")
            _assert_option(db, line.color_option_id, expected_code="color")
        detailings: list[DetailingItem] = []
        if line.kind == ProductModelMaterialKind.FABRIC:
            detailings = _resolve_detailings(
                db,
                line,
                product_type_id=model.product_type_id,
            )
        row = ProductModelMaterialLine(
            product_model_id=model_id,
            kind=line.kind,
            nomenclature_id=line.nomenclature_id,
            planned_qty=Decimal(line.planned_qty),
            sequence=line.sequence if line.sequence else index,
            fabric_stage_code=line.fabric_stage_code,
            type_option_id=line.type_option_id,
            color_option_id=line.color_option_id,
        )
        row.detailing_items = detailings
        db.add(row)

    db.commit()
    return list_model_material_lines(db, model_id)
