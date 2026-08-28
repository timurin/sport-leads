"""Sewing-operation catalog file import adapter (roadmap 4.5.4 / ADR-020)."""

from __future__ import annotations

from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.models.sewing_operation import SewingOperation
from app.models.shop_routing import WorkCenter
from app.repositories import sewing_operations as repo
from app.schemas.file_io import FileIoRowError
from app.schemas.sewing_operation import (
    SewingOperationCreate,
    SewingOperationFolderCreate,
    SewingOperationImportResult,
    SewingOperationRead,
    SewingOperationUpdate,
    SEWING_OPERATION_DESCRIPTION_MAX,
)
from app.services.file_io import (
    FileIoParseError,
    build_dry_run_envelope,
    parse_tabular_bytes,
    remap_row,
)
from app.services.sewing_operation_file_columns import (
    FOLDER_PATH_SEPARATOR,
    LIST_VALUE_SEPARATOR,
)
from app.services.sewing_operations import (
    SewingOperationConflictError,
    SewingOperationFolderConflictError,
    SewingOperationFolderNotFoundError,
    SewingOperationFolderValidationError,
    SewingOperationNotFoundError,
    SewingOperationValidationError,
    _resolve_sewing_work_centers,
    create_sewing_operation,
    create_sewing_operation_folder,
    get_sewing_operation,
    update_sewing_operation,
)

COLUMN_ALIASES: dict[str, str] = {
    "id": "id",
    "name": "name",
    "наименование": "name",
    "название": "name",
    "description": "description",
    "описание": "description",
    "folder_path": "folder_path",
    "папка": "folder_path",
    "sort_order": "sort_order",
    "work_center_codes": "work_center_codes",
    "оборудование": "work_center_codes",
}


class SewingOperationImportError(RuntimeError):
    pass


class _RowPlan:
    def __init__(
        self,
        *,
        name: str,
        description: str | None,
        folder_parts: list[str] | None,
        sort_order: int | None,
        work_center_ids: list[int] | None,
        existing: SewingOperation | None,
        present: set[str],
    ) -> None:
        self.name = name
        self.description = description
        self.folder_parts = folder_parts
        self.sort_order = sort_order
        self.work_center_ids = work_center_ids
        self.existing = existing
        self.present = present


def build_column_map(headers: list[str]) -> dict[str, str]:
    mapping: dict[str, str] = {}
    for header in headers:
        key = header.strip().lower()
        canonical = COLUMN_ALIASES.get(key)
        if canonical is not None:
            mapping[header] = canonical
    return mapping


def parse_folder_path(value: str) -> list[str] | FileIoRowError:
    stripped = value.strip()
    if not stripped:
        return []
    parts = [part.strip() for part in stripped.split(FOLDER_PATH_SEPARATOR)]
    if any(not part for part in parts):
        return FileIoRowError(
            row_number=0,
            column="folder_path",
            code="invalid_folder_path",
            message="Пустой сегмент в folder_path",
        )
    return parts


def import_sewing_operations_from_bytes(
    db: Session,
    data: bytes,
    *,
    filename: str | None = None,
    content_type: str | None = None,
    sheet_name: str | None = None,
    dry_run: bool = True,
    preview_limit: int = 20,
) -> SewingOperationImportResult:
    try:
        table = parse_tabular_bytes(
            data,
            filename=filename,
            content_type=content_type,
            sheet_name=sheet_name,
        )
    except FileIoParseError as error:
        raise SewingOperationImportError(str(error)) from error

    column_map = build_column_map(table.headers)
    present = set(column_map.values())
    header_errors: list[FileIoRowError] = []
    if "name" not in present:
        header_errors.append(
            FileIoRowError(
                row_number=0,
                column="name",
                code="missing_column",
                message="Required column 'name' (or alias) is missing",
            )
        )

    errors: list[FileIoRowError] = list(header_errors)
    plans: list[_RowPlan] = []
    preview: list[dict[str, Any]] = []
    seen_names: dict[str, int] = {}
    seen_ids: dict[int, int] = {}

    if not header_errors:
        for index, raw_row in enumerate(table.rows, start=1):
            mapped = remap_row(raw_row, column_map)
            row_errors, plan = _plan_row(db, index, mapped, present)
            if row_errors or plan is None:
                errors.extend(row_errors)
                continue

            name_key = plan.name.casefold()
            if name_key in seen_names:
                errors.append(
                    FileIoRowError(
                        row_number=index,
                        column="name",
                        code="duplicate_in_file",
                        message=(
                            f"Duplicate name in file (also row {seen_names[name_key]})"
                        ),
                    )
                )
                continue
            if plan.existing is not None:
                if plan.existing.id in seen_ids:
                    errors.append(
                        FileIoRowError(
                            row_number=index,
                            column="id",
                            code="duplicate_in_file",
                            message=(
                                f"Duplicate target id {plan.existing.id} "
                                f"(also row {seen_ids[plan.existing.id]})"
                            ),
                        )
                    )
                    continue
                clash = _get_by_name_ci(db, plan.name)
                if clash is not None and clash.id != plan.existing.id:
                    errors.append(
                        FileIoRowError(
                            row_number=index,
                            column="name",
                            code="name_taken",
                            message=f"Name '{plan.name}' already used by id {clash.id}",
                        )
                    )
                    continue
                seen_ids[plan.existing.id] = index

            seen_names[name_key] = index
            plans.append(plan)
            if len(preview) < preview_limit:
                preview.append(
                    {
                        "id": plan.existing.id if plan.existing is not None else None,
                        "name": plan.name,
                        "description": plan.description,
                        "folder_path": (
                            FOLDER_PATH_SEPARATOR.join(plan.folder_parts)
                            if plan.folder_parts is not None
                            else None
                        ),
                        "sort_order": plan.sort_order,
                        "work_center_ids": plan.work_center_ids,
                        "_action": "update" if plan.existing is not None else "create",
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
        planned_creates = sum(1 for plan in plans if plan.existing is None)
        planned_updates = sum(1 for plan in plans if plan.existing is not None)
        return SewingOperationImportResult(
            **envelope.model_dump(),
            created_count=planned_creates if dry_run else 0,
            updated_count=planned_updates if dry_run else 0,
        )

    created: list[SewingOperation] = []
    updated: list[SewingOperation] = []
    folder_cache: dict[tuple[str, ...], int | None] = {(): None}
    try:
        for plan in plans:
            folder_id = _resolve_or_create_folder(db, plan.folder_parts, folder_cache)
            if plan.existing is None:
                create_data: dict[str, Any] = {
                    "name": plan.name,
                    "description": plan.description,
                    "folder_id": folder_id,
                    "work_center_ids": plan.work_center_ids or [],
                }
                if plan.sort_order is not None:
                    create_data["sort_order"] = plan.sort_order
                created.append(
                    create_sewing_operation(
                        db, SewingOperationCreate(**create_data), commit=False
                    )
                )
                continue

            update_data: dict[str, Any] = {}
            if "name" in plan.present:
                update_data["name"] = plan.name
            if "description" in plan.present:
                update_data["description"] = plan.description
            if "folder_path" in plan.present:
                update_data["folder_id"] = folder_id
            if "sort_order" in plan.present and plan.sort_order is not None:
                update_data["sort_order"] = plan.sort_order
            if "work_center_codes" in plan.present:
                update_data["work_center_ids"] = plan.work_center_ids or []
            if not update_data:
                continue
            updated.append(
                update_sewing_operation(
                    db,
                    plan.existing.id,
                    SewingOperationUpdate(**update_data),
                    commit=False,
                )
            )
        db.commit()
    except (
        SewingOperationConflictError,
        SewingOperationValidationError,
        SewingOperationNotFoundError,
        SewingOperationFolderConflictError,
        SewingOperationFolderValidationError,
        SewingOperationFolderNotFoundError,
        SewingOperationImportError,
    ) as error:
        db.rollback()
        raise SewingOperationImportError(str(error)) from error

    created_reads = [SewingOperationRead.model_validate(row) for row in created]
    updated_reads = [SewingOperationRead.model_validate(row) for row in updated]
    return SewingOperationImportResult(
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


def _get_by_name_ci(db: Session, name: str) -> SewingOperation | None:
    return db.scalars(
        select(SewingOperation).where(func.lower(SewingOperation.name) == name.casefold())
    ).first()


def _get_work_center_by_code(db: Session, code: str) -> WorkCenter | None:
    return db.scalars(
        select(WorkCenter)
        .options(selectinload(WorkCenter.production_stage))
        .where(func.lower(WorkCenter.code) == code.casefold())
    ).first()


def _parse_list(value: str) -> list[str]:
    normalized = (
        value.replace(",", LIST_VALUE_SEPARATOR)
        .replace(";", LIST_VALUE_SEPARATOR)
        .replace("\n", LIST_VALUE_SEPARATOR)
    )
    return [part.strip() for part in normalized.split(LIST_VALUE_SEPARATOR) if part.strip()]


def _cell(mapped: dict[str, str | None], key: str) -> str:
    raw = mapped.get(key)
    if raw is None:
        return ""
    return str(raw).strip()


def _plan_row(
    db: Session,
    index: int,
    mapped: dict[str, str | None],
    present: set[str],
) -> tuple[list[FileIoRowError], _RowPlan | None]:
    errors: list[FileIoRowError] = []
    name = _cell(mapped, "name")
    if not name:
        errors.append(
            FileIoRowError(
                row_number=index,
                column="name",
                code="required",
                message="Name is required",
            )
        )

    existing: SewingOperation | None = None
    id_raw = _cell(mapped, "id") if "id" in present else ""
    if id_raw:
        try:
            operation_id = int(id_raw)
        except ValueError:
            errors.append(
                FileIoRowError(
                    row_number=index,
                    column="id",
                    code="invalid_id",
                    message="id must be an integer",
                )
            )
        else:
            try:
                existing = get_sewing_operation(db, operation_id)
            except SewingOperationNotFoundError:
                errors.append(
                    FileIoRowError(
                        row_number=index,
                        column="id",
                        code="not_found",
                        message=f"Operation id {operation_id} not found",
                    )
                )
    elif name:
        existing = _get_by_name_ci(db, name)

    description: str | None = None
    if "description" in present:
        desc_raw = _cell(mapped, "description")
        if desc_raw:
            if len(desc_raw) > SEWING_OPERATION_DESCRIPTION_MAX:
                errors.append(
                    FileIoRowError(
                        row_number=index,
                        column="description",
                        code="invalid_description",
                        message=(
                            "description must be ≤ "
                            f"{SEWING_OPERATION_DESCRIPTION_MAX} characters"
                        ),
                    )
                )
            else:
                description = desc_raw
        else:
            description = None

    sort_order: int | None = None
    if "sort_order" in present:
        sort_raw = _cell(mapped, "sort_order")
        if sort_raw:
            try:
                sort_order = int(sort_raw)
            except ValueError:
                errors.append(
                    FileIoRowError(
                        row_number=index,
                        column="sort_order",
                        code="invalid_sort_order",
                        message="sort_order must be an integer ≥ 0",
                    )
                )
            else:
                if sort_order < 0:
                    errors.append(
                        FileIoRowError(
                            row_number=index,
                            column="sort_order",
                            code="invalid_sort_order",
                            message="sort_order must be ≥ 0",
                        )
                    )

    folder_parts: list[str] | None
    if "folder_path" in present:
        parsed = parse_folder_path(_cell(mapped, "folder_path"))
        if isinstance(parsed, FileIoRowError):
            parsed.row_number = index
            errors.append(parsed)
            folder_parts = None
        else:
            folder_parts = parsed
    else:
        folder_parts = None if existing is not None else []

    work_center_ids: list[int] | None = None
    if "work_center_codes" in present:
        codes = _parse_list(_cell(mapped, "work_center_codes"))
        work_center_ids = []
        seen_codes: set[str] = set()
        for code in codes:
            key = code.casefold()
            if key in seen_codes:
                continue
            seen_codes.add(key)
            center = _get_work_center_by_code(db, code)
            if center is None:
                errors.append(
                    FileIoRowError(
                        row_number=index,
                        column="work_center_codes",
                        code="unknown_work_center",
                        message=f"Work center code '{code}' not found",
                    )
                )
                continue
            try:
                _resolve_sewing_work_centers(db, [center.id])
            except SewingOperationValidationError as error:
                errors.append(
                    FileIoRowError(
                        row_number=index,
                        column="work_center_codes",
                        code="invalid_work_center",
                        message=str(error),
                    )
                )
                continue
            work_center_ids.append(center.id)

    if errors or not name:
        return errors, None

    return (
        [],
        _RowPlan(
            name=name,
            description=description,
            folder_parts=folder_parts,
            sort_order=sort_order,
            work_center_ids=work_center_ids,
            existing=existing,
            present=present,
        ),
    )


def _resolve_or_create_folder(
    db: Session,
    parts: list[str] | None,
    cache: dict[tuple[str, ...], int | None],
) -> int | None:
    if parts is None:
        return None
    key = tuple(part.casefold() for part in parts)
    if key in cache:
        return cache[key]
    parent_id: int | None = None
    walked: list[str] = []
    for part in parts:
        walked.append(part)
        walked_key = tuple(item.casefold() for item in walked)
        if walked_key in cache:
            parent_id = cache[walked_key]
            continue
        existing = repo.find_sibling_folder_by_name(
            db, parent_id=parent_id, name=part
        )
        if existing is None:
            created = create_sewing_operation_folder(
                db,
                SewingOperationFolderCreate(name=part, parent_id=parent_id),
                commit=False,
            )
            parent_id = created.id
        else:
            parent_id = existing.id
        cache[walked_key] = parent_id
    cache[key] = parent_id
    return parent_id
