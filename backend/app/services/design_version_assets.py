"""DesignVersion assets + comments service (ADR-022 / 10.1.2.3)."""

from __future__ import annotations

import base64
import binascii
import re
import uuid
from pathlib import Path

from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.design_project import (
    DesignProject,
    DesignProjectStatus,
    DesignVersion,
    DesignVersionAsset,
    DesignVersionAssetKind,
    DesignVersionComment,
)
from app.repositories import design_projects as repo
from app.schemas.design_project import (
    DesignVersionAssetCreate,
    DesignVersionAssetRead,
    DesignVersionAssetUpdate,
    DesignVersionCommentCreate,
    DesignVersionCommentRead,
)
from app.services.design_projects import (
    DesignProjectConflictError,
    DesignProjectNotFoundError,
    DesignProjectValidationError,
    DesignVersionNotFoundError,
)

MEDIA_ROOT = Path("storage/design-version-media").resolve()
MAX_FILE_SIZE = 20 * 1024 * 1024
ALLOWED_ASSET_MIMES = frozenset(
    {
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/svg+xml",
        "application/pdf",
    }
)
_ASSET_KINDS = frozenset(k.value for k in DesignVersionAssetKind)


def design_asset_content_url(
    project_id: int, version_id: int, asset_id: int
) -> str:
    return (
        f"/design-projects/{project_id}/versions/{version_id}/assets/{asset_id}/content"
    )


def _asset_read(
    asset: DesignVersionAsset, *, project_id: int
) -> DesignVersionAssetRead:
    return DesignVersionAssetRead(
        id=asset.id,
        design_version_id=asset.design_version_id,
        kind=asset.kind,
        filename=asset.filename,
        mime_type=asset.mime_type,
        file_size=asset.file_size,
        sort_order=asset.sort_order,
        is_primary=asset.is_primary,
        content_url=design_asset_content_url(
            project_id, asset.design_version_id, asset.id
        ),
        created_at=asset.created_at,
        updated_at=asset.updated_at,
    )


def _comment_read(comment: DesignVersionComment) -> DesignVersionCommentRead:
    return DesignVersionCommentRead(
        id=comment.id,
        design_version_id=comment.design_version_id,
        body=comment.body,
        author_name=comment.author_name,
        created_at=comment.created_at,
        updated_at=comment.updated_at,
    )


def _load_project_version(
    db: Session, project_id: int, version_id: int
) -> tuple[DesignProject, DesignVersion]:
    project = repo.get_design_project(db, project_id)
    if project is None:
        raise DesignProjectNotFoundError("Дизайн-проект не найден")
    version = repo.get_design_version(db, version_id)
    if version is None or version.design_project_id != project_id:
        raise DesignVersionNotFoundError("Версия дизайна не найдена")
    return project, version


def _reject_if_archived(project: DesignProject) -> None:
    if project.status == DesignProjectStatus.ARCHIVED.value:
        raise DesignProjectValidationError(
            "Нельзя менять активы/комментарии в archived-проекте"
        )


def _safe_filename(filename: str) -> str:
    name = Path(filename).name.strip()
    if not name or name in {".", ".."}:
        raise DesignProjectValidationError("Некорректное имя файла")
    return re.sub(r"[^A-Za-z0-9._-]", "_", name)[:255]


def _decode(content: str) -> bytes:
    try:
        data = base64.b64decode(content, validate=True)
    except (binascii.Error, ValueError) as error:
        raise DesignProjectValidationError("Некорректный base64 контент") from error
    if not data or len(data) > MAX_FILE_SIZE:
        raise DesignProjectValidationError(
            "Размер файла должен быть от 1 байта до 20 MB"
        )
    return data


def _assert_mime(mime_type: str) -> None:
    if mime_type not in ALLOWED_ASSET_MIMES:
        raise DesignProjectValidationError(f"Неподдерживаемый mime type: {mime_type}")


def _assert_kind(kind: str) -> None:
    if kind not in _ASSET_KINDS:
        raise DesignProjectValidationError(f"Недопустимый kind: {kind}")


def _clear_primary(db: Session, design_version_id: int, except_id: int | None = None) -> None:
    statement = update(DesignVersionAsset).where(
        DesignVersionAsset.design_version_id == design_version_id
    )
    if except_id is not None:
        statement = statement.where(DesignVersionAsset.id != except_id)
    db.execute(statement.values(is_primary=False))


def list_design_version_assets(
    db: Session, project_id: int, version_id: int
) -> list[DesignVersionAssetRead]:
    _load_project_version(db, project_id, version_id)
    rows = list(
        db.scalars(
            select(DesignVersionAsset)
            .where(DesignVersionAsset.design_version_id == version_id)
            .order_by(DesignVersionAsset.sort_order, DesignVersionAsset.id)
        ).all()
    )
    return [_asset_read(row, project_id=project_id) for row in rows]


def create_design_version_asset(
    db: Session,
    project_id: int,
    version_id: int,
    payload: DesignVersionAssetCreate,
) -> DesignVersionAssetRead:
    project, _version = _load_project_version(db, project_id, version_id)
    _reject_if_archived(project)
    _assert_kind(payload.kind)
    _assert_mime(payload.mime_type)
    data = _decode(payload.content_base64)
    filename = _safe_filename(payload.filename)
    key = f"design-version/{version_id}/{uuid.uuid4().hex}-{filename}"
    path = MEDIA_ROOT / key
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)

    if payload.is_primary:
        _clear_primary(db, version_id)

    row = DesignVersionAsset(
        design_version_id=version_id,
        kind=payload.kind,
        filename=filename,
        storage_key=key,
        mime_type=payload.mime_type,
        file_size=len(data),
        sort_order=payload.sort_order,
        is_primary=bool(payload.is_primary),
    )
    try:
        db.add(row)
        db.commit()
        db.refresh(row)
    except IntegrityError as error:
        db.rollback()
        if path.exists():
            path.unlink()
        raise DesignProjectConflictError(
            "Не удалось сохранить asset (конфликт primary/storage_key)"
        ) from error
    return _asset_read(row, project_id=project_id)


def update_design_version_asset(
    db: Session,
    project_id: int,
    version_id: int,
    asset_id: int,
    payload: DesignVersionAssetUpdate,
) -> DesignVersionAssetRead:
    project, _version = _load_project_version(db, project_id, version_id)
    _reject_if_archived(project)
    row = db.scalar(
        select(DesignVersionAsset).where(
            DesignVersionAsset.id == asset_id,
            DesignVersionAsset.design_version_id == version_id,
        )
    )
    if row is None:
        raise DesignVersionNotFoundError("Asset не найден")

    data = payload.model_dump(exclude_unset=True)
    if "kind" in data and data["kind"] is not None:
        _assert_kind(data["kind"])
        row.kind = data["kind"]
    if "sort_order" in data and data["sort_order"] is not None:
        row.sort_order = data["sort_order"]
    if data.get("is_primary") is True:
        _clear_primary(db, version_id, except_id=asset_id)
        row.is_primary = True
    elif data.get("is_primary") is False:
        row.is_primary = False

    try:
        db.commit()
        db.refresh(row)
    except IntegrityError as error:
        db.rollback()
        raise DesignProjectConflictError(
            "Не удалось обновить asset"
        ) from error
    return _asset_read(row, project_id=project_id)


def delete_design_version_asset(
    db: Session, project_id: int, version_id: int, asset_id: int
) -> None:
    project, _version = _load_project_version(db, project_id, version_id)
    _reject_if_archived(project)
    row = db.scalar(
        select(DesignVersionAsset).where(
            DesignVersionAsset.id == asset_id,
            DesignVersionAsset.design_version_id == version_id,
        )
    )
    if row is None:
        raise DesignVersionNotFoundError("Asset не найден")
    path = (MEDIA_ROOT / row.storage_key).resolve()
    if MEDIA_ROOT not in path.parents:
        raise DesignProjectValidationError("Небезопасный storage path")
    if path.exists():
        path.unlink()
    db.delete(row)
    db.commit()


def design_version_asset_path(
    db: Session, project_id: int, version_id: int, asset_id: int
) -> tuple[Path, str, str]:
    _load_project_version(db, project_id, version_id)
    row = db.scalar(
        select(DesignVersionAsset).where(
            DesignVersionAsset.id == asset_id,
            DesignVersionAsset.design_version_id == version_id,
        )
    )
    if row is None:
        raise DesignVersionNotFoundError("Asset не найден")
    path = (MEDIA_ROOT / row.storage_key).resolve()
    if MEDIA_ROOT not in path.parents or not path.exists():
        raise DesignVersionNotFoundError("Файл asset не найден")
    return path, row.mime_type, row.filename


def list_design_version_comments(
    db: Session, project_id: int, version_id: int
) -> list[DesignVersionCommentRead]:
    _load_project_version(db, project_id, version_id)
    rows = list(
        db.scalars(
            select(DesignVersionComment)
            .where(DesignVersionComment.design_version_id == version_id)
            .order_by(DesignVersionComment.id.asc())
        ).all()
    )
    return [_comment_read(row) for row in rows]


def create_design_version_comment(
    db: Session,
    project_id: int,
    version_id: int,
    payload: DesignVersionCommentCreate,
) -> DesignVersionCommentRead:
    project, _version = _load_project_version(db, project_id, version_id)
    _reject_if_archived(project)
    if not payload.body or not payload.body.strip():
        raise DesignProjectValidationError("Текст комментария обязателен")
    row = DesignVersionComment(
        design_version_id=version_id,
        body=payload.body.strip(),
        author_name=payload.author_name,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _comment_read(row)


def delete_design_version_comment(
    db: Session, project_id: int, version_id: int, comment_id: int
) -> None:
    project, _version = _load_project_version(db, project_id, version_id)
    _reject_if_archived(project)
    row = db.scalar(
        select(DesignVersionComment).where(
            DesignVersionComment.id == comment_id,
            DesignVersionComment.design_version_id == version_id,
        )
    )
    if row is None:
        raise DesignVersionNotFoundError("Комментарий не найден")
    db.delete(row)
    db.commit()
