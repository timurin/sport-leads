"""Sewing-operation catalog export + import template (roadmap 4.5.4 / ADR-020)."""

from __future__ import annotations

from typing import Literal

from sqlalchemy.orm import Session

from app.models.sewing_operation import SewingOperation, SewingOperationFolder
from app.services.file_io import render_csv_bytes, render_xlsx_bytes
from app.services.sewing_operation_file_columns import (
    FOLDER_PATH_SEPARATOR,
    LIST_VALUE_SEPARATOR,
    SEWING_OPERATION_FILE_HEADERS,
    SEWING_OPERATION_TEMPLATE_SAMPLE_ROWS,
)
from app.services.sewing_operations import list_sewing_operation_folders, list_sewing_operations

ExportFormat = Literal["csv", "xlsx"]


class SewingOperationExportError(RuntimeError):
    pass


def export_sewing_operations_file(
    db: Session,
    *,
    file_format: ExportFormat = "csv",
    search: str | None = None,
    limit: int = 5000,
) -> tuple[bytes, str, str]:
    items = list_sewing_operations(
        db, search=search, folder_id=None, limit=limit, offset=0
    )
    folders = {row.id: row for row in list_sewing_operation_folders(db)}
    headers = list(SEWING_OPERATION_FILE_HEADERS)
    rows = [_item_to_export_row(item, folders) for item in items]
    return _render_file(
        headers, rows, file_format=file_format, basename="sewing-operation-export"
    )


def build_sewing_operation_import_template(
    *,
    file_format: ExportFormat = "csv",
) -> tuple[bytes, str, str]:
    headers = list(SEWING_OPERATION_FILE_HEADERS)
    rows = [
        {header: row.get(header, "") for header in headers}
        for row in SEWING_OPERATION_TEMPLATE_SAMPLE_ROWS
    ]
    return _render_file(
        headers,
        rows,
        file_format=file_format,
        basename="sewing-operation-import-template",
    )


def folder_path_for(
    folder_id: int | None, folders: dict[int, SewingOperationFolder]
) -> str:
    if folder_id is None:
        return ""
    parts: list[str] = []
    current = folders.get(folder_id)
    seen: set[int] = set()
    while current is not None:
        if current.id in seen:
            break
        seen.add(current.id)
        parts.append(current.name)
        parent_id = current.parent_id
        current = folders.get(parent_id) if parent_id is not None else None
    return FOLDER_PATH_SEPARATOR.join(reversed(parts))


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
            render_xlsx_bytes(headers, rows, sheet_name="SewingOperations"),
            f"{basename}.xlsx",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
    raise SewingOperationExportError(f"Unsupported format: {file_format}")


def _item_to_export_row(
    item: SewingOperation, folders: dict[int, SewingOperationFolder]
) -> dict[str, str]:
    codes = [row.code for row in item.work_centers if row.code]
    return {
        "id": str(item.id),
        "name": item.name or "",
        "description": item.description or "",
        "folder_path": folder_path_for(item.folder_id, folders),
        "sort_order": str(item.sort_order),
        "work_center_codes": LIST_VALUE_SEPARATOR.join(codes),
        "created_at": item.created_at.isoformat() if item.created_at else "",
        "updated_at": item.updated_at.isoformat() if item.updated_at else "",
    }
