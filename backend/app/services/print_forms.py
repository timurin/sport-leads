"""Print-form registry service (Stage 18.3.3)."""

from __future__ import annotations

import base64
import json
import os
import re
import subprocess
import tempfile
from pathlib import Path
from typing import Any
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.models.print_form import (
    PrintForm,
    PrintFormBindingType,
    PrintFormOutputFormat,
    PrintFormStatus,
    PrintFormVersion,
    PrintFormVersionStorageKind,
    PrintFormVersionStatus,
    PrintFormVersioningMode,
)
from app.schemas.print_forms import (
    PrintFormCreate,
    PrintFormGenerateRequest,
    PrintFormPreviewRequest,
    PrintFormRead,
    PrintFormRenderRead,
    PrintFormVersionCreate,
    PrintFormVersionPublishRequest,
    PrintFormUpdate,
    PrintFormVersionRead,
    PrintFormVersionUpdate,
)
from app.services.platform_directories import PLATFORM_DIRECTORY_REGISTRY

_SLUG_RE = re.compile(r"^[a-z0-9_]+$")
_DIRECTORY_CODES = {item.code for item in PLATFORM_DIRECTORY_REGISTRY}


class PrintFormError(RuntimeError):
    pass


class PrintFormNotFoundError(PrintFormError):
    pass


class PrintFormConflictError(PrintFormError):
    pass


class PrintFormValidationError(PrintFormError):
    pass


def _normalize_slug(value: str) -> str:
    return "_".join(value.strip().lower().replace("-", "_").split())


def _normalize_optional_text(value: str | None) -> str | None:
    normalized = (value or "").strip()
    return normalized or None


def _normalize_required_text(value: str) -> str:
    return " ".join(value.strip().split())


def _validate_slug(value: str, *, field_label: str) -> str:
    normalized = _normalize_slug(value)
    if not normalized:
        raise PrintFormValidationError(f"Укажите {field_label}")
    if not _SLUG_RE.fullmatch(normalized):
        raise PrintFormValidationError(
            f"{field_label.capitalize()} должен содержать только латиницу, цифры и подчёркивания"
        )
    return normalized


def _validate_binding_type(value: str) -> str:
    binding_type = _validate_slug(value, field_label="тип привязки")
    allowed = {item.value for item in PrintFormBindingType}
    if binding_type not in allowed:
        raise PrintFormValidationError(
            "Тип привязки должен быть model, directory или document_type"
        )
    return binding_type


def _validate_output_format(value: str) -> str:
    output_format = _validate_slug(value, field_label="формат вывода")
    allowed = {item.value for item in PrintFormOutputFormat}
    if output_format not in allowed:
        raise PrintFormValidationError("Формат вывода должен быть html, pdf или xlsx")
    return output_format


def _validate_versioning_mode(value: str) -> str:
    versioning_mode = _validate_slug(value, field_label="режим версионирования")
    if versioning_mode != PrintFormVersioningMode.SINGLE_ACTIVE.value:
        raise PrintFormValidationError("MVP поддерживает только режим single_active")
    return versioning_mode


def _validate_binding_key(binding_type: str, value: str) -> str:
    binding_key = _validate_slug(value, field_label="ключ привязки")
    if binding_type == PrintFormBindingType.DIRECTORY.value and binding_key not in _DIRECTORY_CODES:
        raise PrintFormValidationError(
            f"Справочник платформы не найден: {binding_key}"
        )
    return binding_key


def _to_read(row: PrintForm) -> PrintFormRead:
    return PrintFormRead.model_validate(row)


def _current_published_version(row: PrintForm) -> PrintFormVersion | None:
    for version in row.versions:
        if (
            version.is_current
            and version.status == PrintFormVersionStatus.PUBLISHED.value
        ):
            return version
    return None


def _normalize_template_source(value: str) -> str:
    source = value.strip()
    if not source:
        raise PrintFormValidationError("Источник шаблона не должен быть пустым")
    return source


def _validate_version_status(value: str) -> str:
    version_status = _validate_slug(value, field_label="статус версии")
    allowed = {item.value for item in PrintFormVersionStatus}
    if version_status not in allowed:
        raise PrintFormValidationError(
            "Статус версии должен быть draft, published или archived"
        )
    return version_status


def _validate_storage_kind(value: str) -> str:
    storage_kind = _validate_slug(value, field_label="тип хранения")
    allowed = {
        PrintFormVersionStorageKind.INLINE_TEXT.value,
        PrintFormVersionStorageKind.FILE_REF.value,
    }
    if storage_kind not in allowed:
        raise PrintFormValidationError(
            "Тип хранения должен быть inline_text или file_ref"
        )
    return storage_kind


def _to_version_read(row: PrintFormVersion) -> PrintFormVersionRead:
    return PrintFormVersionRead.model_validate(row)


def _get_print_form_row(db: Session, print_form_id: int) -> PrintForm:
    row = db.scalar(
        select(PrintForm)
        .options(selectinload(PrintForm.versions))
        .where(PrintForm.id == print_form_id)
    )
    if row is None:
        raise PrintFormNotFoundError("Печатная форма не найдена")
    return row


def _get_version_row(
    row: PrintForm,
    version_id: int,
) -> PrintFormVersion:
    for version in row.versions:
        if version.id == version_id:
            return version
    raise PrintFormNotFoundError("Версия печатной формы не найдена")


def _set_current_version(
    row: PrintForm,
    target: PrintFormVersion,
    *,
    is_current: bool,
) -> None:
    if not is_current:
        target.is_current = False
        return
    for version in row.versions:
        version.is_current = version.id == target.id


def _resolve_payload_path(payload: dict[str, Any], path: str) -> Any:
    current: Any = payload
    for part in path.split("."):
        if isinstance(current, dict):
            current = current.get(part)
        else:
            return None
    return current


def _stringify_render_value(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, (str, int, float, bool)):
        return str(value)
    return json.dumps(value, ensure_ascii=False)


def _render_template(template_source: str, payload: dict[str, Any]) -> str:
    def replace(match: re.Match[str]) -> str:
        path = match.group(1).strip()
        if not path:
            return ""
        return _stringify_render_value(_resolve_payload_path(payload, path))

    return re.sub(r"\{\{\s*([^{}]+?)\s*\}\}", replace, template_source)


def _content_type_for_format(output_format: str) -> str:
    if output_format == PrintFormOutputFormat.HTML.value:
        return "text/html; charset=utf-8"
    if output_format == PrintFormOutputFormat.PDF.value:
        return "application/pdf"
    return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


def _resolve_chromium_executable_path() -> str | None:
    local_app_data = os.getenv("LOCALAPPDATA")
    if not local_app_data:
        return None
    root = Path(local_app_data) / "ms-playwright"
    if not root.exists():
        return None
    candidates = sorted(
        root.glob("chromium-*/chrome-win64/chrome.exe"),
        reverse=True,
    )
    for candidate in candidates:
        if candidate.is_file():
            return str(candidate)
    return None


def _render_pdf_bytes(html: str) -> bytes:
    try:
        with sync_playwright() as playwright:
            launch_kwargs: dict[str, Any] = {"headless": True}
            executable_path = _resolve_chromium_executable_path()
            if executable_path:
                launch_kwargs["executable_path"] = executable_path
            browser = playwright.chromium.launch(**launch_kwargs)
            context = browser.new_context(locale="ru-RU")
            page = context.new_page()
            page.set_content(html, wait_until="networkidle")
            page.wait_for_timeout(250)
            pdf = page.pdf(
                format="A4",
                print_background=True,
                prefer_css_page_size=True,
            )
            context.close()
            browser.close()
            return pdf
    except PlaywrightError as error:
        raise PrintFormValidationError(f"Не удалось сформировать PDF: {error}") from error


def _render_pdf_bytes_chrome(html: str) -> bytes:
    executable_path = _resolve_chromium_executable_path()
    if not executable_path:
        raise PrintFormValidationError("Не найден локальный Chromium для формирования PDF")

    try:
        with tempfile.TemporaryDirectory(prefix="sl-print-form-") as temp_dir:
            temp_path = Path(temp_dir)
            html_path = temp_path / "print-form.html"
            pdf_path = temp_path / "print-form.pdf"
            html_path.write_text(html, encoding="utf-8")
            result = subprocess.run(
                [
                    executable_path,
                    "--headless=new",
                    "--disable-gpu",
                    "--no-first-run",
                    "--no-default-browser-check",
                    f"--print-to-pdf={pdf_path}",
                    str(html_path),
                ],
                capture_output=True,
                text=True,
                timeout=60,
                check=False,
            )
            if result.returncode != 0:
                detail = (result.stderr or result.stdout or "chrome print-to-pdf failed").strip()
                raise PrintFormValidationError(f"Не удалось сформировать PDF: {detail}")
            if not pdf_path.is_file():
                raise PrintFormValidationError("Не удалось сформировать PDF: файл PDF не создан")
            return pdf_path.read_bytes()
    except subprocess.TimeoutExpired as error:
        raise PrintFormValidationError("Не удалось сформировать PDF: превышено время ожидания") from error


def _render_result(
    row: PrintForm,
    version: PrintFormVersion,
    *,
    payload: dict[str, Any],
    is_preview: bool,
    requested_output_format: str | None = None,
) -> PrintFormRenderRead:
    output_format = requested_output_format or row.output_format
    content = _render_template(version.template_source, payload)
    content_encoding = "text"
    if output_format == PrintFormOutputFormat.PDF.value:
        content = base64.b64encode(_render_pdf_bytes_chrome(content)).decode("ascii")
        content_encoding = "base64"
    return PrintFormRenderRead(
        print_form_id=row.id,
        print_form_code=row.code,
        version_id=version.id,
        version_no=version.version_no,
        output_format=output_format,
        content_type=_content_type_for_format(output_format),
        file_name=f"{row.code}-v{version.version_no}.{output_format}",
        content=content,
        content_encoding=content_encoding,
        is_preview=is_preview,
    )


def list_print_forms(
    db: Session,
    *,
    binding_type: str | None = None,
    status: str | None = None,
    q: str | None = None,
    limit: int = 200,
    offset: int = 0,
) -> list[PrintFormRead]:
    stmt = select(PrintForm).options(selectinload(PrintForm.versions))
    if binding_type and binding_type.strip():
        stmt = stmt.where(
            PrintForm.binding_type == _validate_binding_type(binding_type)
        )
    if status and status.strip():
        normalized_status = _validate_slug(status, field_label="статус")
        allowed = {item.value for item in PrintFormStatus}
        if normalized_status not in allowed:
            raise PrintFormValidationError(
                "Статус должен быть draft, active или archived"
            )
        stmt = stmt.where(PrintForm.status == normalized_status)
    if q and q.strip():
        needle = f"%{q.strip().lower()}%"
        stmt = stmt.where(
            func.lower(PrintForm.code).like(needle)
            | func.lower(PrintForm.title).like(needle)
            | func.lower(PrintForm.binding_key).like(needle)
        )
    stmt = (
        stmt.order_by(PrintForm.updated_at.desc(), PrintForm.id.desc())
        .offset(offset)
        .limit(limit)
    )
    rows = db.scalars(stmt).unique().all()
    return [_to_read(row) for row in rows]


def get_print_form(db: Session, print_form_id: int) -> PrintFormRead:
    return _to_read(_get_print_form_row(db, print_form_id))


def create_print_form(db: Session, payload: PrintFormCreate) -> PrintFormRead:
    binding_type = _validate_binding_type(payload.binding_type)
    if payload.status != PrintFormStatus.DRAFT.value:
        raise PrintFormValidationError(
            "Новая печатная форма создаётся только в статусе draft"
        )
    row = PrintForm(
        code=_validate_slug(payload.code, field_label="код"),
        title=_normalize_required_text(payload.title),
        description=_normalize_optional_text(payload.description),
        binding_type=binding_type,
        binding_key=_validate_binding_key(binding_type, payload.binding_key),
        status=PrintFormStatus.DRAFT.value,
        output_format=_validate_output_format(payload.output_format),
        versioning_mode=_validate_versioning_mode(payload.versioning_mode),
    )
    if not row.title:
        raise PrintFormValidationError("Укажите название печатной формы")
    db.add(row)
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise PrintFormConflictError(
            "Печатная форма с таким кодом или привязкой уже существует"
        ) from error
    return get_print_form(db, row.id)


def update_print_form(
    db: Session,
    print_form_id: int,
    payload: PrintFormUpdate,
) -> PrintFormRead:
    row = _get_print_form_row(db, print_form_id)
    changes = payload.model_dump(exclude_unset=True)
    if not changes:
        raise PrintFormValidationError("Нет полей для обновления")
    if "status" in changes and changes["status"] is not None:
        raise PrintFormValidationError(
            "Статус меняется только через activate/archive"
        )

    original_binding_type = row.binding_type
    binding_type = row.binding_type
    binding_key = row.binding_key
    if "binding_type" in changes and changes["binding_type"] is not None:
        binding_type = _validate_binding_type(changes["binding_type"])
        row.binding_type = binding_type
    if "binding_key" in changes and changes["binding_key"] is not None:
        binding_key = _validate_binding_key(binding_type, changes["binding_key"])
        row.binding_key = binding_key
    elif binding_type != original_binding_type:
        row.binding_key = _validate_binding_key(binding_type, binding_key)

    if "title" in changes and changes["title"] is not None:
        title = _normalize_required_text(changes["title"])
        if not title:
            raise PrintFormValidationError("Укажите название печатной формы")
        row.title = title
    if "description" in changes:
        row.description = _normalize_optional_text(changes["description"])
    if "output_format" in changes and changes["output_format"] is not None:
        row.output_format = _validate_output_format(changes["output_format"])
    if "versioning_mode" in changes and changes["versioning_mode"] is not None:
        row.versioning_mode = _validate_versioning_mode(changes["versioning_mode"])

    db.add(row)
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise PrintFormConflictError(
            "Печатная форма с таким кодом или привязкой уже существует"
        ) from error
    return get_print_form(db, print_form_id)


def activate_print_form(db: Session, print_form_id: int) -> PrintFormRead:
    row = _get_print_form_row(db, print_form_id)
    if _current_published_version(row) is None:
        raise PrintFormValidationError(
            "Для активации нужна текущая опубликованная версия шаблона"
        )
    row.status = PrintFormStatus.ACTIVE.value
    db.add(row)
    db.commit()
    return get_print_form(db, print_form_id)


def archive_print_form(db: Session, print_form_id: int) -> PrintFormRead:
    row = db.get(PrintForm, print_form_id)
    if row is None:
        raise PrintFormNotFoundError("Печатная форма не найдена")
    row.status = PrintFormStatus.ARCHIVED.value
    db.add(row)
    db.commit()
    return get_print_form(db, print_form_id)


def create_print_form_version(
    db: Session,
    print_form_id: int,
    payload: PrintFormVersionCreate,
) -> PrintFormVersionRead:
    row = _get_print_form_row(db, print_form_id)
    next_version_no = max((version.version_no for version in row.versions), default=0) + 1
    version = PrintFormVersion(
        print_form_id=row.id,
        version_no=next_version_no,
        template_label=_normalize_required_text(payload.template_label),
        storage_kind=_validate_storage_kind(payload.storage_kind),
        template_source=_normalize_template_source(payload.template_source),
        status=_validate_version_status(payload.status),
        is_current=False,
    )
    db.add(version)
    db.flush()
    _set_current_version(row, version, is_current=payload.is_current)
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise PrintFormConflictError(
            "Не удалось сохранить версию печатной формы"
        ) from error
    db.refresh(version)
    return _to_version_read(version)


def update_print_form_version(
    db: Session,
    print_form_id: int,
    version_id: int,
    payload: PrintFormVersionUpdate,
) -> PrintFormVersionRead:
    row = _get_print_form_row(db, print_form_id)
    version = _get_version_row(row, version_id)
    changes = payload.model_dump(exclude_unset=True)
    if not changes:
        raise PrintFormValidationError("Нет полей для обновления версии")
    if version.status == PrintFormVersionStatus.PUBLISHED.value and any(
        key in changes for key in ("template_label", "storage_kind", "template_source")
    ):
        raise PrintFormValidationError(
            "Опубликованную версию нельзя менять; создайте новую"
        )
    if "template_label" in changes and changes["template_label"] is not None:
        version.template_label = _normalize_required_text(changes["template_label"])
    if "storage_kind" in changes and changes["storage_kind"] is not None:
        version.storage_kind = _validate_storage_kind(changes["storage_kind"])
    if "template_source" in changes and changes["template_source"] is not None:
        version.template_source = _normalize_template_source(changes["template_source"])
    if "status" in changes and changes["status"] is not None:
        version.status = _validate_version_status(changes["status"])
    if "is_current" in changes and changes["is_current"] is not None:
        _set_current_version(row, version, is_current=bool(changes["is_current"]))
    db.add(version)
    db.commit()
    db.refresh(version)
    return _to_version_read(version)


def publish_print_form_version(
    db: Session,
    print_form_id: int,
    version_id: int,
    payload: PrintFormVersionPublishRequest,
) -> PrintFormVersionRead:
    row = _get_print_form_row(db, print_form_id)
    version = _get_version_row(row, version_id)
    version.status = PrintFormVersionStatus.PUBLISHED.value
    _set_current_version(row, version, is_current=payload.is_current)
    db.add(version)
    db.commit()
    db.refresh(version)
    return _to_version_read(version)


def preview_print_form(
    db: Session,
    print_form_id: int,
    payload: PrintFormPreviewRequest,
) -> PrintFormRenderRead:
    row = _get_print_form_row(db, print_form_id)
    version = (
        _get_version_row(row, payload.version_id)
        if payload.version_id is not None
        else (_current_published_version(row) or (row.versions[-1] if row.versions else None))
    )
    if version is None:
        raise PrintFormValidationError("Для превью нужна хотя бы одна версия шаблона")
    return _render_result(row, version, payload=payload.payload, is_preview=True)


def generate_print_form(
    db: Session,
    payload: PrintFormGenerateRequest,
) -> PrintFormRenderRead:
    binding_type = _validate_binding_type(payload.binding_type)
    binding_key = _validate_binding_key(binding_type, payload.binding_key)
    output_format = _validate_output_format(payload.output_format)
    row = db.scalar(
        select(PrintForm)
        .options(selectinload(PrintForm.versions))
        .where(
            PrintForm.binding_type == binding_type,
            PrintForm.binding_key == binding_key,
            PrintForm.output_format == output_format,
            PrintForm.status == PrintFormStatus.ACTIVE.value,
        )
    )
    if row is None and output_format == PrintFormOutputFormat.PDF.value:
        row = db.scalar(
            select(PrintForm)
            .options(selectinload(PrintForm.versions))
            .where(
                PrintForm.binding_type == binding_type,
                PrintForm.binding_key == binding_key,
                PrintForm.output_format == PrintFormOutputFormat.HTML.value,
                PrintForm.status == PrintFormStatus.ACTIVE.value,
            )
        )
    if row is None:
        raise PrintFormNotFoundError("Активная печатная форма не настроена")
    version = _current_published_version(row)
    if version is None:
        raise PrintFormValidationError(
            "У активной печатной формы нет текущей опубликованной версии"
        )
    return _render_result(
        row,
        version,
        payload=payload.payload,
        is_preview=False,
        requested_output_format=output_format,
    )
