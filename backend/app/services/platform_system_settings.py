"""Platform system settings service (18.1.2)."""

from __future__ import annotations

import re
import uuid
from pathlib import Path

from sqlalchemy.orm import Session

from app.models.platform_system_settings import PlatformSystemSettings
from app.schemas.platform_system_settings import (
    PlatformBrandRead,
    PlatformSystemSettingsRead,
    PlatformSystemSettingsUpdate,
)

MEDIA_ROOT = Path("storage/platform-system").resolve()
LOGO_CONTENT_URL = "/platform-system-settings/logo/content"
MAX_LOGO_BYTES = 5 * 1024 * 1024
ALLOWED_LOGO_MIMES = frozenset(
    {
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/svg+xml",
    }
)


class PlatformSystemSettingsError(RuntimeError):
    pass


class PlatformSystemSettingsValidationError(PlatformSystemSettingsError):
    pass


class PlatformSystemSettingsNotFoundError(PlatformSystemSettingsError):
    pass


def _default_row() -> PlatformSystemSettings:
    return PlatformSystemSettings(
        id=1,
        organization_display_name="Sport-Lead",
        default_timezone="Europe/Moscow",
        support_email=None,
        ui_locale="ru-RU",
        notes=None,
        logo_storage_key=None,
        logo_mime_type=None,
        logo_original_filename=None,
    )


def ensure_platform_system_settings(db: Session) -> PlatformSystemSettings:
    row = db.get(PlatformSystemSettings, 1)
    if row is not None:
        return row
    row = _default_row()
    db.add(row)
    db.flush()
    return row


def _to_read(row: PlatformSystemSettings) -> PlatformSystemSettingsRead:
    has_logo = bool(row.logo_storage_key)
    return PlatformSystemSettingsRead(
        id=row.id,
        organization_display_name=row.organization_display_name,
        default_timezone=row.default_timezone,
        support_email=row.support_email,
        ui_locale=row.ui_locale,
        notes=row.notes,
        logo_url=LOGO_CONTENT_URL if has_logo else None,
        logo_filename=row.logo_original_filename if has_logo else None,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def get_platform_system_settings(db: Session) -> PlatformSystemSettingsRead:
    row = ensure_platform_system_settings(db)
    return _to_read(row)


def get_platform_brand(db: Session) -> PlatformBrandRead:
    row = ensure_platform_system_settings(db)
    has_logo = bool(row.logo_storage_key)
    return PlatformBrandRead(
        organization_display_name=row.organization_display_name,
        logo_url=LOGO_CONTENT_URL if has_logo else None,
    )


def update_platform_system_settings(
    db: Session,
    payload: PlatformSystemSettingsUpdate,
) -> PlatformSystemSettingsRead:
    row = ensure_platform_system_settings(db)
    row.organization_display_name = payload.organization_display_name.strip()
    row.default_timezone = payload.default_timezone.strip()
    email = (payload.support_email or "").strip()
    row.support_email = email or None
    row.ui_locale = payload.ui_locale.strip()
    notes = (payload.notes or "").strip()
    row.notes = notes or None
    db.add(row)
    db.commit()
    db.refresh(row)
    return _to_read(row)


def _safe_filename(filename: str) -> str:
    name = Path(filename).name.strip()
    if not name or name in {".", ".."}:
        raise PlatformSystemSettingsValidationError("Некорректное имя файла")
    return re.sub(r"[^A-Za-z0-9._-]", "_", name)[:255]


def _ext_for_mime(mime: str, filename: str) -> str:
    by_mime = {
        "image/jpeg": ".jpg",
        "image/png": ".png",
        "image/webp": ".webp",
        "image/svg+xml": ".svg",
    }
    if mime in by_mime:
        return by_mime[mime]
    suffix = Path(filename).suffix.lower()
    if suffix in {".jpg", ".jpeg", ".png", ".webp", ".svg"}:
        return ".jpg" if suffix == ".jpeg" else suffix
    return ".bin"


def logo_file_path(row: PlatformSystemSettings) -> Path:
    if not row.logo_storage_key:
        raise PlatformSystemSettingsNotFoundError("Логотип не загружен")
    path = (MEDIA_ROOT / row.logo_storage_key).resolve()
    if not str(path).startswith(str(MEDIA_ROOT)):
        raise PlatformSystemSettingsValidationError("Некорректный путь логотипа")
    if not path.is_file():
        raise PlatformSystemSettingsNotFoundError("Файл логотипа не найден")
    return path


def upload_platform_logo(
    db: Session,
    *,
    filename: str,
    mime_type: str,
    content: bytes,
) -> PlatformSystemSettingsRead:
    if mime_type not in ALLOWED_LOGO_MIMES:
        raise PlatformSystemSettingsValidationError(
            "Допустимы JPEG, PNG, WebP или SVG"
        )
    if not content:
        raise PlatformSystemSettingsValidationError("Пустой файл")
    if len(content) > MAX_LOGO_BYTES:
        raise PlatformSystemSettingsValidationError(
            "Логотип не больше 5 МБ"
        )

    safe_name = _safe_filename(filename)
    ext = _ext_for_mime(mime_type, safe_name)
    storage_key = f"logo-{uuid.uuid4().hex}{ext}"
    MEDIA_ROOT.mkdir(parents=True, exist_ok=True)
    target = MEDIA_ROOT / storage_key
    target.write_bytes(content)

    row = ensure_platform_system_settings(db)
    if row.logo_storage_key:
        old = MEDIA_ROOT / row.logo_storage_key
        if old.is_file():
            old.unlink(missing_ok=True)

    row.logo_storage_key = storage_key
    row.logo_mime_type = mime_type
    row.logo_original_filename = safe_name
    db.add(row)
    db.commit()
    db.refresh(row)
    return _to_read(row)


def clear_platform_logo(db: Session) -> PlatformSystemSettingsRead:
    row = ensure_platform_system_settings(db)
    if row.logo_storage_key:
        old = MEDIA_ROOT / row.logo_storage_key
        if old.is_file():
            old.unlink(missing_ok=True)
    row.logo_storage_key = None
    row.logo_mime_type = None
    row.logo_original_filename = None
    db.add(row)
    db.commit()
    db.refresh(row)
    return _to_read(row)
