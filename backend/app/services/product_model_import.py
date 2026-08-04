"""Product model catalog file import adapter (roadmap 4.5.3 / ADR-020)."""

from __future__ import annotations

import base64
from datetime import date, datetime
from pathlib import Path
from typing import Any

from pydantic import ValidationError
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.product_model import ProductModel, ProductModelSizeType, ProductModelStatus
from app.models.product_type import ProductType
from app.models.size_grid import SizeGrid
from app.repositories import assembly_variants as assembly_repo
from app.repositories import product_model_routings as routing_links_repo
from app.repositories import product_models as product_model_repo
from app.repositories import shop_routings as shop_routings_repo
from app.schemas.file_io import FileIoRowError
from app.schemas.product_model import (
    AssemblyVariantReorder,
    ProductModelCreate,
    ProductModelImportResult,
    ProductModelMediaCreate,
    ProductModelRead,
    ProductModelRoutingLinkCreate,
    ProductModelRoutingLinkReorder,
    ProductModelUpdate,
)
from app.services.assembly_variants import (
    AssemblyVariantValidationError,
    reorder_assembly_variants,
)
from app.services.file_io import (
    FileIoParseError,
    build_dry_run_envelope,
    parse_tabular_bytes,
    remap_row,
)
from app.services.product_model_file_columns import LIST_VALUE_SEPARATOR
from app.services.product_model_routings import (
    ProductModelRoutingConflictError,
    ProductModelRoutingValidationError,
    create_routing_link,
    delete_routing_link,
    reorder_routing_links,
)
from app.services.product_models import (
    MEDIA_ROOT,
    ProductModelArticleConflictError,
    ProductModelNotFoundError,
    ProductModelValidationError,
    activate_product_model,
    add_product_model_media,
    archive_product_model,
    create_product_model,
    list_product_model_media,
    update_product_model,
)


COLUMN_ALIASES: dict[str, str] = {
    "id": "id",
    "article": "article",
    "артикул": "article",
    "name": "name",
    "наименование": "name",
    "название": "name",
    "size_type": "size_type",
    "тип_размера": "size_type",
    "size_grid_name": "size_grid_name",
    "размерная_сетка": "size_grid_name",
    "product_type_name": "product_type_name",
    "вид_изделия": "product_type_name",
    "description": "description",
    "описание": "description",
    "patterns_path": "patterns_path",
    "constructor_name": "constructor_name",
    "конструктор": "constructor_name",
    "patterns_created_on": "patterns_created_on",
    "default_routing_code": "default_routing_code",
    "маршрут": "default_routing_code",
    "assembly_variant_ids": "assembly_variant_ids",
    "сборки": "assembly_variant_ids",
    "варианты_сборки": "assembly_variant_ids",
    "routing_template_ids": "routing_template_ids",
    "маршруты": "routing_template_ids",
    "варианты_маршрутов": "routing_template_ids",
    "photo_paths": "photo_paths",
    "фото": "photo_paths",
    "картинки": "photo_paths",
    "photo_urls": "photo_urls",
    "status": "status",
    "статус": "status",
}


class ProductModelImportError(RuntimeError):
    pass


def build_column_map(headers: list[str]) -> dict[str, str]:
    mapping: dict[str, str] = {}
    for header in headers:
        key = header.strip().lower()
        canonical = COLUMN_ALIASES.get(key)
        if canonical is not None:
            mapping[header] = canonical
    return mapping


def import_product_models_from_bytes(
    db: Session,
    data: bytes,
    *,
    filename: str | None = None,
    content_type: str | None = None,
    sheet_name: str | None = None,
    dry_run: bool = True,
    preview_limit: int = 20,
) -> ProductModelImportResult:
    try:
        table = parse_tabular_bytes(
            data,
            filename=filename,
            content_type=content_type,
            sheet_name=sheet_name,
        )
    except FileIoParseError as error:
        raise ProductModelImportError(str(error)) from error

    column_map = build_column_map(table.headers)
    header_errors: list[FileIoRowError] = []
    present = set(column_map.values())
    for required in ("article", "name", "size_type"):
        if required not in present:
            header_errors.append(
                FileIoRowError(
                    row_number=0,
                    column=required,
                    code="missing_column",
                    message=f"Required column '{required}' (or alias) is missing",
                )
            )

    errors: list[FileIoRowError] = list(header_errors)
    plans: list[
        tuple[
            int,
            ProductModelCreate,
            ProductModel | None,
            ProductModelStatus | None,
            list[int] | None,
            list[int] | None,
            list[str] | None,
        ]
    ] = []
    preview: list[dict[str, Any]] = []
    seen_articles: dict[str, int] = {}
    seen_ids: dict[int, int] = {}

    if not header_errors:
        for index, raw_row in enumerate(table.rows, start=1):
            mapped = remap_row(raw_row, column_map)
            row_errors, payload, target_status = _row_to_payload(db, index, mapped)
            if row_errors or payload is None:
                errors.extend(row_errors)
                continue

            assembly_ids, assembly_errors = _parse_optional_id_list(
                index, "assembly_variant_ids", mapped
            )
            errors.extend(assembly_errors)
            routing_ids, routing_errors = _parse_optional_id_list(
                index, "routing_template_ids", mapped
            )
            errors.extend(routing_errors)
            photo_paths, photo_errors = _parse_optional_path_list(
                index, "photo_paths", mapped
            )
            errors.extend(photo_errors)
            if assembly_errors or routing_errors or photo_errors:
                continue

            article_key = payload.article.casefold()
            if article_key in seen_articles:
                errors.append(
                    FileIoRowError(
                        row_number=index,
                        column="article",
                        code="duplicate_in_file",
                        message=(
                            f"Duplicate article in file "
                            f"(also row {seen_articles[article_key]})"
                        ),
                    )
                )
                continue

            existing, match_errors = _resolve_existing(
                db, index, mapped, payload.article
            )
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
                if existing.article.casefold() != article_key:
                    clash = product_model_repo.get_product_model_by_article(
                        db, payload.article
                    )
                    if clash is not None and clash.id != existing.id:
                        errors.append(
                            FileIoRowError(
                                row_number=index,
                                column="article",
                                code="article_taken",
                                message=(
                                    f"Article '{payload.article}' already used by "
                                    f"id {clash.id}"
                                ),
                            )
                        )
                        continue
                seen_ids[existing.id] = index

            relation_errors = _validate_relation_ids(
                db,
                index,
                existing=existing,
                assembly_variant_ids=assembly_ids,
                routing_template_ids=routing_ids,
            )
            if relation_errors:
                errors.extend(relation_errors)
                continue

            seen_articles[article_key] = index
            plans.append(
                (
                    index,
                    payload,
                    existing,
                    target_status,
                    assembly_ids,
                    routing_ids,
                    photo_paths,
                )
            )
            if len(preview) < preview_limit:
                preview.append(
                    {
                        **payload.model_dump(mode="json"),
                        "_action": "update" if existing is not None else "create",
                        "_existing_id": existing.id if existing is not None else None,
                        "_status": target_status.value if target_status else None,
                        "_assembly_variant_ids": assembly_ids,
                        "_routing_template_ids": routing_ids,
                        "_photo_paths": photo_paths,
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
        planned_creates = sum(
            1 for _i, _p, existing, _s, _a, _r, _ph in plans if existing is None
        )
        planned_updates = sum(
            1 for _i, _p, existing, _s, _a, _r, _ph in plans if existing is not None
        )
        return ProductModelImportResult(
            **envelope.model_dump(),
            created_count=planned_creates if dry_run else 0,
            updated_count=planned_updates if dry_run else 0,
            created_ids=[],
            updated_ids=[],
            created=[],
            updated=[],
        )

    created: list[ProductModel] = []
    updated: list[ProductModel] = []
    try:
        for (
            _index,
            payload,
            existing,
            target_status,
            assembly_ids,
            routing_ids,
            photo_paths,
        ) in plans:
            if existing is None:
                item = create_product_model(db, payload)
                item = _apply_imported_status(db, item, target_status)
                _apply_relation_ids(
                    db,
                    item,
                    assembly_variant_ids=assembly_ids,
                    routing_template_ids=routing_ids,
                )
                _apply_photo_paths(db, item, photo_paths)
                created.append(item)
            else:
                update_data = {
                    key: value
                    for key, value in payload.model_dump().items()
                    if key
                    not in {
                        "status",
                        "default_routing_template_id",
                    }
                }
                item = update_product_model(
                    db, existing.id, ProductModelUpdate(**update_data)
                )
                item = _apply_imported_status(db, item, target_status)
                _apply_relation_ids(
                    db,
                    item,
                    assembly_variant_ids=assembly_ids,
                    routing_template_ids=routing_ids,
                )
                _apply_photo_paths(db, item, photo_paths)
                updated.append(item)
    except (
        ProductModelArticleConflictError,
        ProductModelValidationError,
        ProductModelNotFoundError,
        AssemblyVariantValidationError,
        ProductModelRoutingValidationError,
        ProductModelRoutingConflictError,
        ProductModelImportError,
    ) as error:
        raise ProductModelImportError(str(error)) from error

    created_reads = [_to_read(item) for item in created]
    updated_reads = [_to_read(item) for item in updated]
    return ProductModelImportResult(
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


def _to_read(item: ProductModel) -> ProductModelRead:
    product_type_name = None
    if item.product_type is not None:
        product_type_name = item.product_type.name
    return ProductModelRead.model_validate(item).model_copy(
        update={"product_type_name": product_type_name, "has_journal_operations": False}
    )


def _apply_imported_status(
    db: Session,
    item: ProductModel,
    target: ProductModelStatus | None,
) -> ProductModel:
    if target is None or target == item.status:
        return item
    if target == ProductModelStatus.ACTIVE:
        return activate_product_model(db, item.id)
    if target == ProductModelStatus.ARCHIVED:
        return archive_product_model(db, item.id)
    if target == ProductModelStatus.DRAFT and item.status != ProductModelStatus.DRAFT:
        # Leave non-draft as-is on import to avoid journal/draft side-effects.
        return item
    return item


def _resolve_existing(
    db: Session,
    row_number: int,
    mapped: dict[str, str | None],
    article: str,
) -> tuple[ProductModel | None, list[FileIoRowError]]:
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
        item = product_model_repo.get_product_model(db, item_id)
        if item is None:
            return None, [
                FileIoRowError(
                    row_number=row_number,
                    column="id",
                    code="not_found",
                    message=f"Product model id {item_id} not found",
                )
            ]
        return item, []

    item = db.scalars(
        select(ProductModel).where(
            func.lower(ProductModel.article) == article.strip().casefold()
        )
    ).first()
    return item, []


def _row_to_payload(
    db: Session,
    row_number: int,
    mapped: dict[str, str | None],
) -> tuple[list[FileIoRowError], ProductModelCreate | None, ProductModelStatus | None]:
    errors: list[FileIoRowError] = []

    article = (mapped.get("article") or "").strip()
    name = (mapped.get("name") or "").strip()
    if not article:
        errors.append(
            FileIoRowError(
                row_number=row_number,
                column="article",
                code="required",
                message="article is required",
            )
        )
    if not name:
        errors.append(
            FileIoRowError(
                row_number=row_number,
                column="name",
                code="required",
                message="name is required",
            )
        )

    size_raw = (mapped.get("size_type") or "").strip().lower()
    size_type: ProductModelSizeType | None = None
    try:
        size_type = ProductModelSizeType(size_raw) if size_raw else None
    except ValueError:
        errors.append(
            FileIoRowError(
                row_number=row_number,
                column="size_type",
                code="invalid_size_type",
                message="size_type must be men|women|kids",
            )
        )
    if size_type is None and not errors:
        errors.append(
            FileIoRowError(
                row_number=row_number,
                column="size_type",
                code="required",
                message="size_type is required",
            )
        )

    status_raw = (mapped.get("status") or "").strip().lower()
    target_status: ProductModelStatus | None = None
    if status_raw:
        try:
            target_status = ProductModelStatus(status_raw)
        except ValueError:
            errors.append(
                FileIoRowError(
                    row_number=row_number,
                    column="status",
                    code="invalid_status",
                    message="status must be draft|active|archived",
                )
            )

    size_grid_id, size_from_grid, grid_errors = _resolve_size_grid(
        db, row_number, mapped.get("size_grid_name"), size_type
    )
    errors.extend(grid_errors)
    if size_from_grid is not None:
        size_type = size_from_grid

    product_type_id, pt_errors = _resolve_product_type(
        db, row_number, mapped.get("product_type_name")
    )
    errors.extend(pt_errors)

    routing_id, route_errors = _resolve_routing(
        db, row_number, mapped.get("default_routing_code")
    )
    errors.extend(route_errors)

    patterns_created_on, date_errors = _parse_optional_date(
        row_number, "patterns_created_on", mapped.get("patterns_created_on")
    )
    errors.extend(date_errors)

    if errors or size_type is None:
        return errors, None, None

    create_status = ProductModelStatus.DRAFT
    try:
        payload = ProductModelCreate(
            article=article,
            name=name,
            size_type=size_type,
            size_grid_id=size_grid_id,
            product_type_id=product_type_id,
            default_routing_template_id=routing_id,
            description=mapped.get("description") or None,
            patterns_path=mapped.get("patterns_path") or None,
            constructor_name=mapped.get("constructor_name") or None,
            patterns_created_on=patterns_created_on,
            status=create_status,
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
        return errors, None, None

    # Dry-run domain checks without commit: article uniqueness checked at plan time.
    try:
        if size_grid_id is not None or product_type_id is not None or routing_id is not None:
            # Re-run through create path validators via temporary update-like checks
            from app.services import product_models as pm_service

            pm_service._validate_product_type_link(db, product_type_id)  # noqa: SLF001
            if routing_id is not None:
                pm_service._validate_routing_template_link(db, routing_id)  # noqa: SLF001
    except ProductModelValidationError as error:
        errors.append(
            FileIoRowError(
                row_number=row_number,
                column=None,
                code="domain",
                message=str(error),
            )
        )
        return errors, None, None

    return errors, payload, target_status


def _resolve_size_grid(
    db: Session,
    row_number: int,
    raw_name: str | None,
    size_type: ProductModelSizeType | None,
) -> tuple[int | None, ProductModelSizeType | None, list[FileIoRowError]]:
    if raw_name is None or str(raw_name).strip() == "":
        return None, None, []
    name = str(raw_name).strip()
    statement = select(SizeGrid).where(func.lower(SizeGrid.name) == name.casefold())
    matches = list(db.scalars(statement).all())
    if not matches:
        return None, None, [
            FileIoRowError(
                row_number=row_number,
                column="size_grid_name",
                code="not_found",
                message=f"size_grid_name '{name}' not found",
            )
        ]
    if size_type is not None:
        typed = [
            grid
            for grid in matches
            if str(getattr(grid.size_type, "value", grid.size_type)) == size_type.value
        ]
        if typed:
            matches = typed
    if len(matches) > 1:
        return None, None, [
            FileIoRowError(
                row_number=row_number,
                column="size_grid_name",
                code="ambiguous",
                message=f"Multiple size grids named '{name}' — set size_type",
            )
        ]
    grid = matches[0]
    size_type_raw = str(getattr(grid.size_type, "value", grid.size_type))
    return grid.id, ProductModelSizeType(size_type_raw), []


def _resolve_product_type(
    db: Session, row_number: int, raw: str | None
) -> tuple[int | None, list[FileIoRowError]]:
    if raw is None or str(raw).strip() == "":
        return None, []
    name = str(raw).strip()
    product_type = db.scalars(
        select(ProductType).where(func.lower(ProductType.name) == name.casefold())
    ).first()
    if product_type is None:
        return None, [
            FileIoRowError(
                row_number=row_number,
                column="product_type_name",
                code="not_found",
                message=f"product_type_name '{name}' not found",
            )
        ]
    return product_type.id, []


def _resolve_routing(
    db: Session, row_number: int, raw: str | None
) -> tuple[int | None, list[FileIoRowError]]:
    if raw is None or str(raw).strip() == "":
        return None, []
    from app.models.shop_routing import ShopRoutingTemplate

    token = str(raw).strip()
    by_code = db.scalars(
        select(ShopRoutingTemplate).where(
            func.lower(ShopRoutingTemplate.code) == token.casefold()
        )
    ).first()
    if by_code is not None:
        return by_code.id, []
    by_name = db.scalars(
        select(ShopRoutingTemplate).where(
            func.lower(ShopRoutingTemplate.name) == token.casefold()
        )
    ).first()
    if by_name is not None:
        return by_name.id, []
    return None, [
        FileIoRowError(
            row_number=row_number,
            column="default_routing_code",
            code="not_found",
            message=f"routing '{token}' not found",
        )
    ]


def _parse_optional_date(
    row_number: int, column: str, raw: str | None
) -> tuple[date | None, list[FileIoRowError]]:
    if raw is None or str(raw).strip() == "":
        return None, []
    text = str(raw).strip()
    try:
        if "T" in text:
            return datetime.fromisoformat(text.replace("Z", "+00:00")).date(), []
        return date.fromisoformat(text), []
    except ValueError:
        return None, [
            FileIoRowError(
                row_number=row_number,
                column=column,
                code="invalid_date",
                message=f"{column} must be YYYY-MM-DD",
            )
        ]


def _parse_optional_id_list(
    row_number: int,
    column: str,
    mapped: dict[str, str | None],
) -> tuple[list[int] | None, list[FileIoRowError]]:
    """None = column absent; [] = present but empty."""
    if column not in mapped:
        return None, []
    raw = mapped.get(column)
    if raw is None or str(raw).strip() == "":
        return [], []
    parts = [
        part.strip()
        for part in str(raw)
        .replace(",", LIST_VALUE_SEPARATOR)
        .replace(";", LIST_VALUE_SEPARATOR)
        .split(LIST_VALUE_SEPARATOR)
        if part.strip()
    ]
    ids: list[int] = []
    errors: list[FileIoRowError] = []
    for part in parts:
        try:
            ids.append(int(part))
        except ValueError:
            errors.append(
                FileIoRowError(
                    row_number=row_number,
                    column=column,
                    code="invalid_int",
                    message=f"{column} entries must be integers (got '{part}')",
                )
            )
    if errors:
        return None, errors
    # Preserve order, drop duplicates.
    return list(dict.fromkeys(ids)), []


def _parse_optional_path_list(
    row_number: int,
    column: str,
    mapped: dict[str, str | None],
) -> tuple[list[str] | None, list[FileIoRowError]]:
    """None = column absent; [] = present but empty. Validates local files exist."""
    if column not in mapped:
        return None, []
    raw = mapped.get(column)
    if raw is None or str(raw).strip() == "":
        return [], []
    parts = [
        part.strip()
        for part in str(raw)
        .replace(",", LIST_VALUE_SEPARATOR)
        .replace(";", LIST_VALUE_SEPARATOR)
        .split(LIST_VALUE_SEPARATOR)
        if part.strip()
    ]
    paths: list[str] = []
    errors: list[FileIoRowError] = []
    for part in parts:
        try:
            resolved = _resolve_photo_path(part)
        except ProductModelImportError as error:
            errors.append(
                FileIoRowError(
                    row_number=row_number,
                    column=column,
                    code="not_found",
                    message=str(error),
                )
            )
            continue
        mime = _guess_image_mime(resolved)
        if mime not in {"image/jpeg", "image/png", "image/webp"}:
            errors.append(
                FileIoRowError(
                    row_number=row_number,
                    column=column,
                    code="invalid_mime",
                    message=(
                        f"unsupported photo mime for {resolved.name}: {mime}"
                    ),
                )
            )
            continue
        paths.append(str(resolved))
    if errors:
        return None, errors
    return list(dict.fromkeys(paths)), []


def _guess_image_mime(path: Path) -> str | None:
    by_suffix = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".webp": "image/webp",
    }
    return by_suffix.get(path.suffix.lower())


def _resolve_photo_path(path_str: str) -> Path:
    path = Path(path_str)
    if path.is_file():
        return path
    alt = MEDIA_ROOT / path_str
    if alt.is_file():
        return alt
    raise ProductModelImportError(f"photo path not found: {path_str}")


def _apply_photo_paths(
    db: Session,
    item: ProductModel,
    photo_paths: list[str] | None,
) -> None:
    if not photo_paths:
        return
    existing_names = {
        media.filename for media in list_product_model_media(db, item.id)
    }
    for path_str in photo_paths:
        path = Path(path_str)
        if path.name in existing_names:
            continue
        mime = _guess_image_mime(path)
        if mime not in {"image/jpeg", "image/png", "image/webp"}:
            raise ProductModelImportError(
                f"unsupported photo mime for {path.name}: {mime}"
            )
        data = path.read_bytes()
        if not data:
            raise ProductModelImportError(f"empty photo file: {path}")
        add_product_model_media(
            db,
            item.id,
            ProductModelMediaCreate(
                filename=path.name,
                mime_type=mime,
                content_base64=base64.b64encode(data).decode("ascii"),
                is_primary=len(existing_names) == 0,
            ),
        )
        existing_names.add(path.name)


def _validate_relation_ids(
    db: Session,
    row_number: int,
    *,
    existing: ProductModel | None,
    assembly_variant_ids: list[int] | None,
    routing_template_ids: list[int] | None,
) -> list[FileIoRowError]:
    errors: list[FileIoRowError] = []

    if assembly_variant_ids is not None:
        if existing is None and assembly_variant_ids:
            errors.append(
                FileIoRowError(
                    row_number=row_number,
                    column="assembly_variant_ids",
                    code="create_not_supported",
                    message=(
                        "assembly_variant_ids only apply when updating an existing "
                        "model (reorder); leave empty on create"
                    ),
                )
            )
        elif existing is not None and assembly_variant_ids:
            owned = {
                variant.id
                for variant in assembly_repo.list_variants(
                    db, existing.id, active_only=False
                )
            }
            if set(assembly_variant_ids) != owned:
                errors.append(
                    FileIoRowError(
                        row_number=row_number,
                        column="assembly_variant_ids",
                        code="mismatch",
                        message=(
                            "assembly_variant_ids must list every assembly variant "
                            f"of the model (expected {sorted(owned)})"
                        ),
                    )
                )

    if routing_template_ids is not None:
        for template_id in routing_template_ids:
            template = shop_routings_repo.get_routing_template(db, template_id)
            if template is None:
                errors.append(
                    FileIoRowError(
                        row_number=row_number,
                        column="routing_template_ids",
                        code="not_found",
                        message=f"routing template id {template_id} not found",
                    )
                )
            elif not template.is_active:
                errors.append(
                    FileIoRowError(
                        row_number=row_number,
                        column="routing_template_ids",
                        code="inactive",
                        message=f"routing template id {template_id} is inactive",
                    )
                )
    return errors


def _apply_relation_ids(
    db: Session,
    item: ProductModel,
    *,
    assembly_variant_ids: list[int] | None,
    routing_template_ids: list[int] | None,
) -> None:
    if assembly_variant_ids:
        reorder_assembly_variants(
            db,
            item.id,
            AssemblyVariantReorder(assembly_variant_ids=assembly_variant_ids),
        )

    if routing_template_ids is None:
        return

    existing_links = routing_links_repo.list_links(db, item.id, active_only=False)
    by_template = {link.shop_routing_template_id: link for link in existing_links}
    desired = list(dict.fromkeys(routing_template_ids))

    for template_id in desired:
        if template_id not in by_template:
            create_routing_link(
                db,
                item.id,
                ProductModelRoutingLinkCreate(
                    shop_routing_template_id=template_id,
                    is_active=True,
                ),
            )

    # Refresh after creates.
    existing_links = routing_links_repo.list_links(db, item.id, active_only=False)
    by_template = {link.shop_routing_template_id: link for link in existing_links}

    for link in list(existing_links):
        if link.shop_routing_template_id not in desired:
            delete_routing_link(db, item.id, link.id)

    existing_links = routing_links_repo.list_links(db, item.id, active_only=False)
    by_template = {link.shop_routing_template_id: link for link in existing_links}
    ordered_link_ids = [
        by_template[template_id].id
        for template_id in desired
        if template_id in by_template
    ]
    if ordered_link_ids:
        reorder_routing_links(
            db,
            item.id,
            ProductModelRoutingLinkReorder(routing_link_ids=ordered_link_ids),
        )
