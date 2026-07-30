"""Nomenclature catalog export + import template (roadmap 4.5.2 / ADR-020)."""

from __future__ import annotations

from typing import Literal

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.models.characteristics import CharacteristicDefinition, CharacteristicOption
from app.models.media import NomenclatureMedia
from app.models.nomenclature import Nomenclature, NomenclatureCategory, NomenclatureType
from app.models.product_model import NomenclatureProductModel, ProductModel
from app.services.characteristics import get_nomenclature_values
from app.services.file_io import render_csv_bytes, render_xlsx_bytes
from app.services.media import MEDIA_ROOT
from app.services.nomenclature_file_columns import (
    LIST_VALUE_SEPARATOR,
    NOMENCLATURE_TEMPLATE_CHAR_CODES,
    NOMENCLATURE_TEMPLATE_SAMPLE_ROWS,
    build_file_headers,
    char_column_name,
)

ExportFormat = Literal["csv", "xlsx"]


class NomenclatureExportError(RuntimeError):
    pass


def export_nomenclatures_file(
    db: Session,
    *,
    file_format: ExportFormat = "csv",
    search: str | None = None,
    is_active: bool | None = None,
    nomenclature_type: NomenclatureType | str | None = None,
    limit: int = 5000,
) -> tuple[bytes, str, str]:
    """Return (bytes, filename, media_type) for catalog rows."""
    items = _list_for_export(
        db,
        search=search,
        is_active=is_active,
        nomenclature_type=nomenclature_type,
        limit=limit,
    )
    char_codes: set[str] = set()
    prepared: list[tuple[Nomenclature, dict[str, str]]] = []
    for item in items:
        row, codes = _item_to_export_row(db, item)
        char_codes.update(codes)
        prepared.append((item, row))

    headers = build_file_headers(sorted(char_codes))
    rows = [{header: row.get(header, "") for header in headers} for _item, row in prepared]
    return _render_file(
        headers, rows, file_format=file_format, basename="nomenclature-export"
    )


def build_nomenclature_import_template(
    *,
    file_format: ExportFormat = "csv",
) -> tuple[bytes, str, str]:
    """Same columns as export; sample rows only (no DB)."""
    headers = build_file_headers(NOMENCLATURE_TEMPLATE_CHAR_CODES)
    rows = [
        {header: row.get(header, "") for header in headers}
        for row in NOMENCLATURE_TEMPLATE_SAMPLE_ROWS
    ]
    return _render_file(
        headers, rows, file_format=file_format, basename="nomenclature-import-template"
    )


def _render_file(
    headers: list[str],
    rows: list[dict[str, str]],
    *,
    file_format: ExportFormat,
    basename: str,
) -> tuple[bytes, str, str]:
    if file_format == "csv":
        return (
            render_csv_bytes(headers, rows),
            f"{basename}.csv",
            "text/csv; charset=utf-8",
        )
    if file_format == "xlsx":
        return (
            render_xlsx_bytes(headers, rows, sheet_name="Nomenclature"),
            f"{basename}.xlsx",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
    raise NomenclatureExportError(f"Unsupported format: {file_format}")


def _list_for_export(
    db: Session,
    *,
    search: str | None,
    is_active: bool | None,
    nomenclature_type: NomenclatureType | str | None,
    limit: int,
) -> list[Nomenclature]:
    statement = select(Nomenclature).options(
        selectinload(Nomenclature.category_relation),
        selectinload(Nomenclature.storage_unit),
        selectinload(Nomenclature.product_type),
    )
    if search and search.strip():
        pattern = f"%{search.strip()}%"
        statement = statement.where(
            or_(
                Nomenclature.name.ilike(pattern),
                Nomenclature.category.ilike(pattern),
                Nomenclature.short_name.ilike(pattern),
            )
        )
    if is_active is not None:
        statement = statement.where(Nomenclature.is_active == is_active)
    if nomenclature_type is not None and str(nomenclature_type).strip():
        type_value = (
            nomenclature_type.value
            if isinstance(nomenclature_type, NomenclatureType)
            else str(nomenclature_type).strip().upper()
        )
        statement = statement.where(Nomenclature.nomenclature_type == type_value)
    statement = statement.order_by(
        Nomenclature.is_active.desc(),
        func.lower(Nomenclature.name),
        Nomenclature.id,
    ).limit(limit)
    return list(db.scalars(statement).all())


def _item_to_export_row(
    db: Session, item: Nomenclature
) -> tuple[dict[str, str], set[str]]:
    category_code = ""
    if item.category_relation is not None:
        category_code = item.category_relation.code or ""
    storage_code = ""
    if item.storage_unit is not None:
        storage_code = item.storage_unit.code or ""
    type_value = (
        item.nomenclature_type.value
        if isinstance(item.nomenclature_type, NomenclatureType)
        else str(item.nomenclature_type)
    )
    product_type_name = ""
    if item.product_type is not None:
        product_type_name = item.product_type.name or ""

    char_codes: set[str] = set()
    char_values: dict[str, str] = {}
    for _assignment, definition, row, _source_id, _inherited in get_nomenclature_values(
        db, item.id
    ):
        if row is None:
            continue
        text = _format_characteristic_cell(db, definition, row)
        if text == "":
            continue
        char_codes.add(definition.code)
        char_values[char_column_name(definition.code)] = text

    articles = _product_model_articles(db, item.id)
    photo_paths, photo_urls = _media_paths(db, item.id)

    row = {
        "id": str(item.id),
        "name": item.name or "",
        "short_name": item.short_name or "",
        "description": item.description or "",
        "category": item.category or "",
        "category_code": category_code,
        "category_path": _category_path(db, item.category_id),
        "nomenclature_type": type_value,
        "product_type_name": product_type_name,
        "unit": item.unit or "",
        "storage_unit_code": storage_code,
        "base_price": f"{item.base_price:.2f}",
        "currency": item.currency or "RUB",
        "is_active": "true" if item.is_active else "false",
        "product_model_articles": LIST_VALUE_SEPARATOR.join(articles),
        "photo_paths": LIST_VALUE_SEPARATOR.join(photo_paths),
        "photo_urls": LIST_VALUE_SEPARATOR.join(photo_urls),
        "created_at": item.created_at.isoformat() if item.created_at else "",
        "updated_at": item.updated_at.isoformat() if item.updated_at else "",
        **char_values,
    }
    return row, char_codes


def _category_path(db: Session, category_id: int | None) -> str:
    if category_id is None:
        return ""
    parts: list[str] = []
    current_id: int | None = category_id
    seen: set[int] = set()
    while current_id is not None and current_id not in seen:
        seen.add(current_id)
        category = db.get(NomenclatureCategory, current_id)
        if category is None:
            break
        parts.append(category.name)
        current_id = category.parent_id
    parts.reverse()
    return " / ".join(parts)


def _product_model_articles(db: Session, nomenclature_id: int) -> list[str]:
    rows = db.execute(
        select(ProductModel.article)
        .join(
            NomenclatureProductModel,
            NomenclatureProductModel.product_model_id == ProductModel.id,
        )
        .where(NomenclatureProductModel.nomenclature_id == nomenclature_id)
        .order_by(NomenclatureProductModel.sort_order, ProductModel.article)
    ).all()
    return [str(article) for (article,) in rows if article]


def _media_paths(db: Session, nomenclature_id: int) -> tuple[list[str], list[str]]:
    media_rows = list(
        db.scalars(
            select(NomenclatureMedia)
            .where(NomenclatureMedia.nomenclature_id == nomenclature_id)
            .order_by(NomenclatureMedia.sort_order, NomenclatureMedia.id)
        ).all()
    )
    paths: list[str] = []
    urls: list[str] = []
    for media in media_rows:
        file_path = MEDIA_ROOT / media.storage_key
        paths.append(str(file_path) if file_path.exists() else media.storage_key)
        urls.append(
            f"/nomenclatures/{nomenclature_id}/media/{media.id}/content"
        )
    return paths, urls


def _format_characteristic_cell(
    db: Session,
    definition: CharacteristicDefinition,
    row,
) -> str:
    kind = definition.kind
    if kind in ("STRING", "TEXT") or (
        kind == "COLOR" and not definition.is_variant_dimension
    ):
        return row.string_value or ""
    if kind == "INTEGER":
        return "" if row.integer_value is None else str(row.integer_value)
    if kind == "DECIMAL":
        return "" if row.decimal_value is None else str(row.decimal_value)
    if kind == "BOOLEAN":
        if row.boolean_value is None:
            return ""
        return "true" if row.boolean_value else "false"
    if kind == "DATE":
        return "" if row.date_value is None else row.date_value.isoformat()
    if kind == "LIST" or (kind == "COLOR" and definition.is_variant_dimension):
        if row.option_id is None:
            return ""
        option = db.get(CharacteristicOption, row.option_id)
        if option is None:
            return ""
        return option.code or option.label
    if kind == "MULTI_SELECT":
        labels = [opt.code or opt.label for opt in (row.options or [])]
        return "|".join(labels)
    return ""
