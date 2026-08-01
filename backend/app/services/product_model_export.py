"""Product model catalog export + import template (roadmap 4.5.3 / ADR-020)."""

from __future__ import annotations

from typing import Literal

from sqlalchemy.orm import Session

from app.models.product_model import ProductModel, ProductModelSizeType, ProductModelStatus
from app.repositories import assembly_variants as assembly_repo
from app.repositories import product_model_routings as routing_links_repo
from app.repositories import product_models as product_model_repo
from app.repositories import shop_routings as shop_routings_repo
from app.services.file_io import render_csv_bytes, render_xlsx_bytes
from app.services.product_model_file_columns import (
    LIST_VALUE_SEPARATOR,
    PRODUCT_MODEL_FILE_HEADERS,
    PRODUCT_MODEL_TEMPLATE_SAMPLE_ROWS,
)
from app.services.product_models import MEDIA_ROOT, list_product_models, media_content_url

ExportFormat = Literal["csv", "xlsx"]


class ProductModelExportError(RuntimeError):
    pass


def export_product_models_file(
    db: Session,
    *,
    file_format: ExportFormat = "csv",
    search: str | None = None,
    status: ProductModelStatus | str | None = None,
    size_type: ProductModelSizeType | str | None = None,
    product_type_id: int | None = None,
    limit: int = 5000,
) -> tuple[bytes, str, str]:
    status_value = _coerce_status(status)
    size_value = _coerce_size_type(size_type)
    items = list_product_models(
        db,
        search=search,
        status=status_value,
        size_type=size_value,
        product_type_id=product_type_id,
        limit=limit,
        offset=0,
    )
    headers = list(PRODUCT_MODEL_FILE_HEADERS)
    rows = [_item_to_export_row(db, item) for item in items]
    return _render_file(
        headers, rows, file_format=file_format, basename="product-model-export"
    )


def build_product_model_import_template(
    *,
    file_format: ExportFormat = "csv",
) -> tuple[bytes, str, str]:
    headers = list(PRODUCT_MODEL_FILE_HEADERS)
    rows = [
        {header: row.get(header, "") for header in headers}
        for row in PRODUCT_MODEL_TEMPLATE_SAMPLE_ROWS
    ]
    return _render_file(
        headers,
        rows,
        file_format=file_format,
        basename="product-model-import-template",
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
            render_xlsx_bytes(headers, rows, sheet_name="ProductModels"),
            f"{basename}.xlsx",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
    raise ProductModelExportError(f"Unsupported format: {file_format}")


def _item_to_export_row(db: Session, item: ProductModel) -> dict[str, str]:
    size_type = (
        item.size_type.value
        if isinstance(item.size_type, ProductModelSizeType)
        else str(item.size_type)
    )
    status = (
        item.status.value
        if isinstance(item.status, ProductModelStatus)
        else str(item.status)
    )
    size_grid_name = ""
    if item.size_grid is not None:
        size_grid_name = item.size_grid.name or ""
    product_type_name = ""
    if item.product_type is not None:
        product_type_name = item.product_type.name or ""
    routing_code = ""
    if item.default_routing_template_id is not None:
        template = shop_routings_repo.get_routing_template(
            db, item.default_routing_template_id
        )
        if template is not None:
            routing_code = template.code or template.name or ""

    assembly_ids = [
        str(variant.id)
        for variant in assembly_repo.list_variants(db, item.id, active_only=False)
    ]
    routing_template_ids = [
        str(link.shop_routing_template_id)
        for link in routing_links_repo.list_links(db, item.id, active_only=False)
    ]
    photo_paths, photo_urls = _media_paths(db, item.id)

    return {
        "id": str(item.id),
        "article": item.article or "",
        "name": item.name or "",
        "size_type": size_type,
        "size_grid_name": size_grid_name,
        "product_type_name": product_type_name,
        "description": item.description or "",
        "patterns_path": item.patterns_path or "",
        "constructor_name": item.constructor_name or "",
        "patterns_created_on": (
            item.patterns_created_on.isoformat() if item.patterns_created_on else ""
        ),
        "default_routing_code": routing_code,
        "assembly_variant_ids": LIST_VALUE_SEPARATOR.join(assembly_ids),
        "routing_template_ids": LIST_VALUE_SEPARATOR.join(routing_template_ids),
        "photo_paths": LIST_VALUE_SEPARATOR.join(photo_paths),
        "photo_urls": LIST_VALUE_SEPARATOR.join(photo_urls),
        "status": status,
        "created_at": item.created_at.isoformat() if item.created_at else "",
        "updated_at": item.updated_at.isoformat() if item.updated_at else "",
    }


def _media_paths(db: Session, model_id: int) -> tuple[list[str], list[str]]:
    media_rows = product_model_repo.list_product_model_media(db, model_id)
    paths: list[str] = []
    urls: list[str] = []
    for media in media_rows:
        file_path = MEDIA_ROOT / media.storage_key
        paths.append(str(file_path) if file_path.exists() else media.storage_key)
        urls.append(media_content_url(model_id, media.id))
    return paths, urls


def _coerce_status(
    value: ProductModelStatus | str | None,
) -> ProductModelStatus | None:
    if value is None or str(value).strip() == "":
        return None
    if isinstance(value, ProductModelStatus):
        return value
    return ProductModelStatus(str(value).strip().lower())


def _coerce_size_type(
    value: ProductModelSizeType | str | None,
) -> ProductModelSizeType | None:
    if value is None or str(value).strip() == "":
        return None
    if isinstance(value, ProductModelSizeType):
        return value
    return ProductModelSizeType(str(value).strip().lower())
