"""Nomenclature catalog file import adapter (roadmap 4.5.1.2 / ADR-020 contour A)."""

from __future__ import annotations

from decimal import Decimal, InvalidOperation
from typing import Any

from pydantic import ValidationError
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.nomenclature import (
    Nomenclature,
    NomenclatureCategory,
    NomenclatureType,
    UnitOfMeasure,
)
from app.schemas.file_io import FileIoRowError
from app.schemas.nomenclature import (
    NomenclatureCreate,
    NomenclatureImportResult,
    NomenclatureUpdate,
)
from app.services.file_io import (
    FileIoParseError,
    build_dry_run_envelope,
    parse_tabular_bytes,
    remap_row,
)
from app.services.nomenclature import (
    NomenclatureCategoryNotFoundError,
    NomenclatureConflictError,
    NomenclatureNotFoundError,
    NomenclatureRuleError,
    UnitOfMeasureNotFoundError,
    UnitOfMeasureRuleError,
    apply_nomenclature_update,
    build_nomenclature_entity,
    to_nomenclature_read,
)
from app.services.nomenclature_history import append_nomenclature_history
from app.services.nomenclature_import_extensions import (
    NomenclatureImportExtensionError,
    apply_import_extensions,
    extract_import_extras,
    resolve_product_type_id_from_extras,
    validate_import_extras,
)

DEFAULT_CATEGORY_LABEL = "Без категории"

# Source header (lower) → canonical import field
COLUMN_ALIASES: dict[str, str] = {
    "id": "id",
    "name": "name",
    "наименование": "name",
    "название": "name",
    "short_name": "short_name",
    "краткое_наименование": "short_name",
    "краткое наименование": "short_name",
    "description": "description",
    "описание": "description",
    "category": "category",
    "категория": "category",
    "category_id": "category_id",
    "category_code": "category_code",
    "код_категории": "category_code",
    "код категории": "category_code",
    "nomenclature_type": "nomenclature_type",
    "type": "nomenclature_type",
    "тип": "nomenclature_type",
    "unit": "unit",
    "ед": "unit",
    "единица": "unit",
    "storage_unit_id": "storage_unit_id",
    "storage_unit_code": "storage_unit_code",
    "код_ед": "storage_unit_code",
    "код ед": "storage_unit_code",
    "base_price": "base_price",
    "price": "base_price",
    "цена": "base_price",
    "currency": "currency",
    "валюта": "currency",
    "is_active": "is_active",
    "активна": "is_active",
    "product_type_id": "product_type_id",
    # Extended / export-only columns remapped only when they feed core payload.
    # product_type_name / models / photos / char:* handled via extras.
}

_TRUE_VALUES = {"1", "true", "yes", "y", "да", "истина", "active", "активна"}
_FALSE_VALUES = {"0", "false", "no", "n", "нет", "ложь", "inactive", "неактивна"}


class NomenclatureImportError(RuntimeError):
    """File-level import failure (parse / empty)."""


def build_column_map(headers: list[str]) -> dict[str, str]:
    """Map present headers to canonical keys via aliases."""
    mapping: dict[str, str] = {}
    for header in headers:
        key = header.strip().lower()
        canonical = COLUMN_ALIASES.get(key)
        if canonical is not None:
            mapping[header] = canonical
    return mapping


def import_nomenclatures_from_bytes(
    db: Session,
    data: bytes,
    *,
    filename: str | None = None,
    content_type: str | None = None,
    sheet_name: str | None = None,
    dry_run: bool = True,
    preview_limit: int = 20,
) -> NomenclatureImportResult:
    try:
        table = parse_tabular_bytes(
            data,
            filename=filename,
            content_type=content_type,
            sheet_name=sheet_name,
        )
    except FileIoParseError as error:
        raise NomenclatureImportError(str(error)) from error

    column_map = build_column_map(table.headers)
    header_errors: list[FileIoRowError] = []
    if "name" not in column_map.values():
        header_errors.append(
            FileIoRowError(
                row_number=0,
                column="name",
                code="missing_column",
                message="Required column 'name' (or alias) is missing",
            )
        )

    errors: list[FileIoRowError] = list(header_errors)
    plans: list[
        tuple[int, NomenclatureCreate, Nomenclature | None, dict[str, str | None]]
    ] = []
    preview: list[dict[str, Any]] = []
    seen_names: dict[str, int] = {}
    seen_ids: dict[int, int] = {}

    if not header_errors:
        for index, raw_row in enumerate(table.rows, start=1):
            mapped = remap_row(raw_row, column_map)
            extras = extract_import_extras(table.headers, raw_row)
            row_errors, payload = _row_to_payload(db, index, mapped, extras)
            if row_errors or payload is None:
                errors.extend(row_errors)
                continue

            name_key = payload.name.casefold()
            if name_key in seen_names:
                errors.append(
                    FileIoRowError(
                        row_number=index,
                        column="name",
                        code="duplicate_in_file",
                        message=(
                            f"Duplicate name in file "
                            f"(also row {seen_names[name_key]})"
                        ),
                    )
                )
                continue

            existing, match_errors = _resolve_existing(db, index, mapped, payload.name)
            if match_errors:
                errors.extend(match_errors)
                continue

            if existing is not None:
                if existing.id in seen_ids:
                    errors.append(
                        FileIoRowError(
                            row_number=index,
                            column="id",
                            code="duplicate_in_file",
                            message=(
                                f"Duplicate target id {existing.id} "
                                f"(also row {seen_ids[existing.id]})"
                            ),
                        )
                    )
                    continue
                if existing.name.casefold() != name_key:
                    clash = db.scalars(
                        select(Nomenclature).where(
                            func.lower(Nomenclature.name) == name_key,
                            Nomenclature.id != existing.id,
                        )
                    ).first()
                    if clash is not None:
                        errors.append(
                            FileIoRowError(
                                row_number=index,
                                column="name",
                                code="name_taken",
                                message=(
                                    f"Name '{payload.name}' already used by "
                                    f"id {clash.id}"
                                ),
                            )
                        )
                        continue
                seen_ids[existing.id] = index

            try:
                validate_import_extras(
                    db,
                    payload.nomenclature_type,
                    payload.product_type_id,
                    extras,
                )
            except NomenclatureImportExtensionError as error:
                errors.append(
                    FileIoRowError(
                        row_number=index,
                        column=None,
                        code="extension",
                        message=str(error),
                    )
                )
                continue

            seen_names[name_key] = index
            plans.append((index, payload, existing, extras))
            if len(preview) < preview_limit:
                preview.append(
                    {
                        **payload.model_dump(mode="json"),
                        "_action": "update" if existing is not None else "create",
                        "_existing_id": existing.id if existing is not None else None,
                        "_extras": {
                            key: value
                            for key, value in extras.items()
                            if value is not None and str(value).strip() != ""
                        },
                    }
                )

    envelope = build_dry_run_envelope(
        total_rows=len(table.rows),
        errors=errors,
        preview=preview,
        preview_limit=preview_limit,
        dry_run=dry_run,
    )

    if dry_run or not envelope.can_commit:
        planned_creates = sum(1 for _i, _p, existing, _e in plans if existing is None)
        planned_updates = sum(1 for _i, _p, existing, _e in plans if existing is not None)
        # When blocked, do not imply a commit plan succeeded; keep planned counts only for dry-run.
        return NomenclatureImportResult(
            **envelope.model_dump(),
            created_count=planned_creates if dry_run else 0,
            updated_count=planned_updates if dry_run else 0,
            created_ids=[],
            updated_ids=[],
            created=[],
            updated=[],
        )

    created: list[Nomenclature] = []
    updated: list[Nomenclature] = []
    extension_jobs: list[tuple[Nomenclature, dict[str, str | None]]] = []
    try:
        for _index, payload, existing, extras in plans:
            if existing is None:
                item = build_nomenclature_entity(db, payload)
                db.add(item)
                db.flush()
                append_nomenclature_history(db, item.id, "Карточка создана")
                created.append(item)
            else:
                update_payload = NomenclatureUpdate(**payload.model_dump())
                item = apply_nomenclature_update(
                    db, existing, update_payload, commit=False
                )
                updated.append(item)
            extension_jobs.append((item, extras))
        db.commit()
        for item in created + updated:
            db.refresh(item)
        for item, extras in extension_jobs:
            apply_import_extensions(db, item, extras)
            db.refresh(item)
    except (
        IntegrityError,
        NomenclatureCategoryNotFoundError,
        NomenclatureRuleError,
        UnitOfMeasureNotFoundError,
        UnitOfMeasureRuleError,
        NomenclatureConflictError,
        NomenclatureNotFoundError,
        NomenclatureImportExtensionError,
    ) as error:
        db.rollback()
        raise NomenclatureImportError(str(error)) from error

    created_reads = [to_nomenclature_read(item) for item in created]
    updated_reads = [to_nomenclature_read(item) for item in updated]
    return NomenclatureImportResult(
        dry_run=False,
        total_rows=envelope.total_rows,
        valid_rows=envelope.valid_rows,
        error_rows=envelope.error_rows,
        errors=[],
        preview=preview,
        can_commit=True,
        created_count=len(created_reads),
        updated_count=len(updated_reads),
        created_ids=[row.id for row in created_reads],
        updated_ids=[row.id for row in updated_reads],
        created=created_reads,
        updated=updated_reads,
    )


def _resolve_existing(
    db: Session,
    row_number: int,
    mapped: dict[str, str | None],
    name: str,
) -> tuple[Nomenclature | None, list[FileIoRowError]]:
    """Match by optional id, else unique case-insensitive name."""
    errors: list[FileIoRowError] = []
    raw_id = mapped.get("id")
    if raw_id and str(raw_id).strip():
        try:
            item_id = int(str(raw_id).strip())
        except ValueError:
            return None, [
                FileIoRowError(
                    row_number=row_number,
                    column="id",
                    code="invalid_int",
                    message="id must be an integer",
                )
            ]
        item = db.get(Nomenclature, item_id)
        if item is None:
            return None, [
                FileIoRowError(
                    row_number=row_number,
                    column="id",
                    code="not_found",
                    message=f"Nomenclature id {item_id} not found",
                )
            ]
        return item, []

    matches = list(
        db.scalars(
            select(Nomenclature).where(
                func.lower(Nomenclature.name) == name.strip().lower()
            )
        ).all()
    )
    if len(matches) > 1:
        return None, [
            FileIoRowError(
                row_number=row_number,
                column="name",
                code="ambiguous_name",
                message=(
                    f"Multiple nomenclatures named '{name}' — "
                    "export with id and re-import"
                ),
            )
        ]
    if len(matches) == 1:
        return matches[0], []
    return None, errors


def _row_to_payload(
    db: Session,
    row_number: int,
    mapped: dict[str, str | None],
    extras: dict[str, str | None] | None = None,
) -> tuple[list[FileIoRowError], NomenclatureCreate | None]:
    errors: list[FileIoRowError] = []
    extras = extras or {}

    name = mapped.get("name")
    if not name:
        errors.append(
            FileIoRowError(
                row_number=row_number,
                column="name",
                code="required",
                message="name is required",
            )
        )

    category_label = mapped.get("category") or DEFAULT_CATEGORY_LABEL
    category_id, cat_errors = _resolve_category_id(db, row_number, mapped)
    errors.extend(cat_errors)

    storage_unit_id, unit_symbol, unit_errors = _resolve_storage_unit(
        db, row_number, mapped
    )
    errors.extend(unit_errors)

    type_raw = mapped.get("nomenclature_type")
    try:
        nomenclature_type = (
            NomenclatureType(type_raw.strip().upper())
            if type_raw
            else NomenclatureType.PRODUCT
        )
    except ValueError:
        errors.append(
            FileIoRowError(
                row_number=row_number,
                column="nomenclature_type",
                code="invalid_type",
                message="nomenclature_type must be SERVICE|PRODUCT|GOODS|MATERIAL",
            )
        )
        nomenclature_type = NomenclatureType.PRODUCT

    price, price_errors = _parse_decimal(
        row_number, "base_price", mapped.get("base_price"), default=Decimal("0")
    )
    errors.extend(price_errors)

    active, active_errors = _parse_bool(
        row_number, "is_active", mapped.get("is_active"), default=True
    )
    errors.extend(active_errors)

    product_type_id, pt_errors = _parse_optional_int(
        row_number, "product_type_id", mapped.get("product_type_id")
    )
    errors.extend(pt_errors)
    if product_type_id is None:
        try:
            product_type_id = resolve_product_type_id_from_extras(db, extras)
        except NomenclatureImportExtensionError as error:
            errors.append(
                FileIoRowError(
                    row_number=row_number,
                    column="product_type_name",
                    code="extension",
                    message=str(error),
                )
            )

    if errors:
        return errors, None

    unit = mapped.get("unit") or unit_symbol or "шт"
    currency = (mapped.get("currency") or "RUB").upper()

    try:
        payload = NomenclatureCreate(
            name=name or "",
            short_name=mapped.get("short_name"),
            description=mapped.get("description"),
            category=category_label[:100],
            category_id=category_id,
            storage_unit_id=storage_unit_id,
            nomenclature_type=nomenclature_type,
            product_type_id=product_type_id,
            unit=unit[:30],
            base_price=price,
            currency=currency,
            is_active=active,
        )
    except ValidationError as error:
        for err in error.errors():
            loc = ".".join(str(part) for part in err.get("loc", ())) or None
            errors.append(
                FileIoRowError(
                    row_number=row_number,
                    column=loc,
                    code="validation",
                    message=str(err.get("msg", "invalid value")),
                )
            )
        return errors, None

    try:
        build_nomenclature_entity(db, payload)
    except (
        NomenclatureCategoryNotFoundError,
        NomenclatureRuleError,
        UnitOfMeasureNotFoundError,
        UnitOfMeasureRuleError,
    ) as error:
        errors.append(
            FileIoRowError(
                row_number=row_number,
                column=None,
                code="domain",
                message=str(error),
            )
        )
        return errors, None

    return [], payload


def _resolve_category_id(
    db: Session,
    row_number: int,
    mapped: dict[str, str | None],
) -> tuple[int | None, list[FileIoRowError]]:
    errors: list[FileIoRowError] = []
    raw_id = mapped.get("category_id")
    raw_code = mapped.get("category_code")
    category_id: int | None = None

    if raw_id:
        try:
            category_id = int(raw_id)
        except ValueError:
            errors.append(
                FileIoRowError(
                    row_number=row_number,
                    column="category_id",
                    code="invalid_int",
                    message="category_id must be an integer",
                )
            )
            return None, errors

    if raw_code:
        code = raw_code.strip().lower()
        found = db.scalars(
            select(NomenclatureCategory).where(NomenclatureCategory.code == code)
        ).first()
        if found is None:
            errors.append(
                FileIoRowError(
                    row_number=row_number,
                    column="category_code",
                    code="not_found",
                    message=f"category_code '{raw_code}' not found",
                )
            )
        elif category_id is not None and found.id != category_id:
            errors.append(
                FileIoRowError(
                    row_number=row_number,
                    column="category_code",
                    code="conflict",
                    message="category_id and category_code refer to different categories",
                )
            )
        else:
            category_id = found.id

    return category_id, errors


def _resolve_storage_unit(
    db: Session,
    row_number: int,
    mapped: dict[str, str | None],
) -> tuple[int | None, str | None, list[FileIoRowError]]:
    errors: list[FileIoRowError] = []
    raw_id = mapped.get("storage_unit_id")
    raw_code = mapped.get("storage_unit_code")
    unit_id: int | None = None
    symbol: str | None = None

    if raw_id:
        try:
            unit_id = int(raw_id)
        except ValueError:
            errors.append(
                FileIoRowError(
                    row_number=row_number,
                    column="storage_unit_id",
                    code="invalid_int",
                    message="storage_unit_id must be an integer",
                )
            )
            return None, None, errors

    if raw_code:
        code = raw_code.strip().upper()
        found = db.scalars(
            select(UnitOfMeasure).where(UnitOfMeasure.code == code)
        ).first()
        if found is None:
            errors.append(
                FileIoRowError(
                    row_number=row_number,
                    column="storage_unit_code",
                    code="not_found",
                    message=f"storage_unit_code '{raw_code}' not found",
                )
            )
        elif unit_id is not None and found.id != unit_id:
            errors.append(
                FileIoRowError(
                    row_number=row_number,
                    column="storage_unit_code",
                    code="conflict",
                    message="storage_unit_id and storage_unit_code refer to different units",
                )
            )
        else:
            unit_id = found.id
            symbol = found.symbol

    if unit_id is not None and symbol is None:
        unit = db.get(UnitOfMeasure, unit_id)
        if unit is not None:
            symbol = unit.symbol

    return unit_id, symbol, errors


def _parse_decimal(
    row_number: int,
    column: str,
    raw: str | None,
    *,
    default: Decimal,
) -> tuple[Decimal, list[FileIoRowError]]:
    if raw is None or raw.strip() == "":
        return default, []
    cleaned = raw.strip().replace(" ", "").replace(",", ".")
    try:
        return Decimal(cleaned), []
    except (InvalidOperation, ValueError):
        return default, [
            FileIoRowError(
                row_number=row_number,
                column=column,
                code="invalid_decimal",
                message=f"{column} must be a number",
            )
        ]


def _parse_bool(
    row_number: int,
    column: str,
    raw: str | None,
    *,
    default: bool,
) -> tuple[bool, list[FileIoRowError]]:
    if raw is None or raw.strip() == "":
        return default, []
    value = raw.strip().lower()
    if value in _TRUE_VALUES:
        return True, []
    if value in _FALSE_VALUES:
        return False, []
    return default, [
        FileIoRowError(
            row_number=row_number,
            column=column,
            code="invalid_bool",
            message=f"{column} must be true/false",
        )
    ]


def _parse_optional_int(
    row_number: int,
    column: str,
    raw: str | None,
) -> tuple[int | None, list[FileIoRowError]]:
    if raw is None or raw.strip() == "":
        return None, []
    try:
        return int(raw.strip()), []
    except ValueError:
        return None, [
            FileIoRowError(
                row_number=row_number,
                column=column,
                code="invalid_int",
                message=f"{column} must be an integer",
            )
        ]
