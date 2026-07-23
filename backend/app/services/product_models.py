from datetime import datetime, timezone
from pathlib import Path
import base64
import binascii
import re
import uuid

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.product_model import (
    ProductModel,
    ProductModelHistoryEntry,
    ProductModelMedia,
    ProductModelSizeType,
    ProductModelStatus,
    ProductModelVersion,
    ProductModelVersionState,
)
from app.models.size_grid import SizeGrid
from app.repositories import product_models as repo
from app.repositories import product_types as product_types_repo
from app.repositories import size_grids as size_grids_repo
from app.schemas.product_model import (
    ProductModelCoverUpload,
    ProductModelCreate,
    ProductModelMediaCreate,
    ProductModelUpdate,
    ProductModelVersionCreate,
)
from app.services.product_model_operations_journal import (
    MODEL_OPERATIONS_WARNING,
    product_model_has_journal_operations,
)

COVER_ROOT = Path("storage/product-model-covers").resolve()
MEDIA_ROOT = Path("storage/product-model-media").resolve()
MAX_COVER_SIZE = 10 * 1024 * 1024
HISTORY_LIMIT = ProductModelHistoryEntry.HISTORY_LIMIT
DEFAULT_ACTOR = "Система"


class ProductModelNotFoundError(RuntimeError):
    pass


class ProductModelArticleConflictError(RuntimeError):
    pass


class ProductModelValidationError(RuntimeError):
    pass


class ProductModelVersionNotFoundError(RuntimeError):
    pass


def _validate_size_grid_link(
    db: Session,
    *,
    size_type: ProductModelSizeType | None,
    size_grid_id: int | None,
) -> SizeGrid | None:
    """Ensure optional size_grid_id exists; optionally check size_type match."""
    if size_grid_id is None:
        return None
    grid = size_grids_repo.get_size_grid(db, size_grid_id)
    if grid is None:
        raise ProductModelValidationError("Размерная сетка не найдена")
    if size_type is not None:
        grid_type = getattr(grid.size_type, "value", grid.size_type)
        model_type = getattr(size_type, "value", size_type)
        if str(grid_type) != str(model_type):
            raise ProductModelValidationError(
                "Размерная сетка должна совпадать с типом размерной сетки модели"
            )
    return grid


def _size_type_from_grid(grid: SizeGrid) -> ProductModelSizeType:
    raw = getattr(grid.size_type, "value", grid.size_type)
    return ProductModelSizeType(str(raw))


def _assert_size_contour_editable(db: Session, model_id: int) -> None:
    if product_model_has_journal_operations(db, model_id):
        raise ProductModelValidationError(MODEL_OPERATIONS_WARNING)


def _validate_product_type_link(db: Session, product_type_id: int | None) -> None:
    if product_type_id is None:
        return
    if product_types_repo.get_product_type(db, product_type_id) is None:
        raise ProductModelValidationError("Тип изделия не найден")


def list_product_models(
    db: Session,
    search: str | None = None,
    status: ProductModelStatus | None = None,
    size_type: ProductModelSizeType | None = None,
    product_type_id: int | None = None,
    limit: int = 100,
    offset: int = 0,
) -> list[ProductModel]:
    return repo.list_product_models(
        db,
        search=search,
        status=status,
        size_type=size_type,
        product_type_id=product_type_id,
        limit=limit,
        offset=offset,
    )


def get_product_model(db: Session, model_id: int) -> ProductModel:
    row = repo.get_product_model(db, model_id)
    if row is None:
        raise ProductModelNotFoundError("Модель изделия не найдена")
    return row


def create_product_model(db: Session, payload: ProductModelCreate) -> ProductModel:
    # Domain default: new models start as draft unless explicitly set on create.
    status = payload.status or ProductModelStatus.DRAFT
    if repo.get_product_model_by_article(db, payload.article) is not None:
        raise ProductModelArticleConflictError("Модель с таким артикулом уже существует")

    size_type = payload.size_type
    size_grid_id = payload.size_grid_id
    if size_grid_id is not None:
        grid = _validate_size_grid_link(db, size_type=None, size_grid_id=size_grid_id)
        assert grid is not None
        size_type = _size_type_from_grid(grid)
    else:
        _validate_size_grid_link(db, size_type=size_type, size_grid_id=None)

    _validate_product_type_link(db, payload.product_type_id)

    row = ProductModel(
        article=payload.article,
        name=payload.name,
        size_type=size_type,
        size_grid_id=size_grid_id,
        product_type_id=payload.product_type_id,
        description=payload.description,
        patterns_path=payload.patterns_path,
        constructor_name=payload.constructor_name,
        patterns_created_on=payload.patterns_created_on,
        cover_image_url=payload.cover_image_url,
        status=status,
    )
    try:
        repo.add_product_model(db, row)
        # PT-08: every model starts with a draft version baseline.
        initial = ProductModelVersion(
            product_model_id=row.id,
            version_number=1,
            label="v1",
            state=ProductModelVersionState.DRAFT,
        )
        repo.add_product_model_version(db, initial)
        db.flush()
        _append_history(db, row.id, "Модель создана")
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise ProductModelArticleConflictError("Модель с таким артикулом уже существует") from error
    db.refresh(row)
    return row


def update_product_model(db: Session, model_id: int, payload: ProductModelUpdate) -> ProductModel:
    row = get_product_model(db, model_id)
    changes = payload.model_dump(exclude_unset=True)
    if not changes:
        return row

    if "article" in changes:
        existing = repo.get_product_model_by_article(db, changes["article"])
        if existing is not None and existing.id != row.id:
            raise ProductModelArticleConflictError("Модель с таким артикулом уже существует")

    # Selecting a size grid is the single UI source of truth; size_type follows the grid.
    if "size_grid_id" in changes and changes["size_grid_id"] is not None:
        grid = _validate_size_grid_link(
            db,
            size_type=None,
            size_grid_id=changes["size_grid_id"],
        )
        assert grid is not None
        changes["size_type"] = _size_type_from_grid(grid)
    elif "size_type" in changes and "size_grid_id" not in changes and row.size_grid_id is not None:
        # Explicit size_type change with an existing grid must stay compatible.
        _validate_size_grid_link(
            db,
            size_type=changes["size_type"],
            size_grid_id=row.size_grid_id,
        )
    elif "size_type" in changes and changes.get("size_grid_id", row.size_grid_id) is not None:
        _validate_size_grid_link(
            db,
            size_type=changes["size_type"],
            size_grid_id=changes.get("size_grid_id", row.size_grid_id),
        )

    size_contour_changing = (
        ("size_type" in changes and changes["size_type"] != row.size_type)
        or ("size_grid_id" in changes and changes["size_grid_id"] != row.size_grid_id)
    )
    if size_contour_changing:
        _assert_size_contour_editable(db, row.id)

    effective_grid_id = changes.get("size_grid_id", row.size_grid_id)
    if row.status != ProductModelStatus.DRAFT and effective_grid_id is None:
        raise ProductModelValidationError(
            "Нельзя снять размерную сетку у активной или архивной модели"
        )

    if "product_type_id" in changes:
        _validate_product_type_link(db, changes["product_type_id"])

    repo.apply_product_model_updates(row, changes)
    summary = ", ".join(sorted(changes.keys()))
    _append_history(db, row.id, f"Обновлены поля: {summary}")
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise ProductModelArticleConflictError("Модель с таким артикулом уже существует") from error
    db.refresh(row)
    return row


_ACTIVATE_FROM = {ProductModelStatus.DRAFT, ProductModelStatus.ARCHIVED}
_ARCHIVE_FROM = {ProductModelStatus.DRAFT, ProductModelStatus.ACTIVE}
_DRAFT_FROM = {ProductModelStatus.ACTIVE, ProductModelStatus.ARCHIVED}


def activate_product_model(db: Session, model_id: int) -> ProductModel:
    row = get_product_model(db, model_id)
    if row.status == ProductModelStatus.ACTIVE:
        return row
    if row.status not in _ACTIVATE_FROM:
        raise ProductModelValidationError(
            f"Нельзя активировать модель из статуса {row.status.value}"
        )
    if row.size_grid_id is None:
        raise ProductModelValidationError(
            "Перед активацией привяжите размерную сетку к модели"
        )
    _validate_size_grid_link(
        db,
        size_type=row.size_type,
        size_grid_id=row.size_grid_id,
    )
    row.status = ProductModelStatus.ACTIVE
    _append_history(db, row.id, "Модель активирована")
    db.commit()
    db.refresh(row)
    return row


def archive_product_model(db: Session, model_id: int) -> ProductModel:
    row = get_product_model(db, model_id)
    if row.status == ProductModelStatus.ARCHIVED:
        return row
    if row.status not in _ARCHIVE_FROM:
        raise ProductModelValidationError(
            f"Нельзя архивировать модель из статуса {row.status.value}"
        )
    row.status = ProductModelStatus.ARCHIVED
    _append_history(db, row.id, "Модель архивирована")
    db.commit()
    db.refresh(row)
    return row


def revert_product_model_to_draft(db: Session, model_id: int) -> ProductModel:
    """Return model to draft when the global ops journal has no rows for it (18.4)."""
    row = get_product_model(db, model_id)
    if row.status == ProductModelStatus.DRAFT:
        return row
    if row.status not in _DRAFT_FROM:
        raise ProductModelValidationError(
            f"Нельзя вернуть модель в черновик из статуса {row.status.value}"
        )
    _assert_size_contour_editable(db, row.id)
    row.status = ProductModelStatus.DRAFT
    _append_history(db, row.id, "Модель возвращена в черновик")
    db.commit()
    db.refresh(row)
    return row


def copy_product_model(db: Session, model_id: int) -> ProductModel:
    """Create a draft copy of the model (new article, status=draft, fresh v1)."""
    source = get_product_model(db, model_id)
    base_article = f"{source.article}-копия"
    article = base_article
    suffix = 2
    while repo.get_product_model_by_article(db, article) is not None:
        article = f"{base_article}-{suffix}"
        suffix += 1

    row = ProductModel(
        article=article,
        name=f"{source.name} (копия)",
        size_type=source.size_type,
        size_grid_id=source.size_grid_id,
        product_type_id=source.product_type_id,
        description=source.description,
        patterns_path=source.patterns_path,
        constructor_name=source.constructor_name,
        patterns_created_on=source.patterns_created_on,
        status=ProductModelStatus.DRAFT,
    )
    try:
        repo.add_product_model(db, row)
        initial = ProductModelVersion(
            product_model_id=row.id,
            version_number=1,
            label="v1",
            state=ProductModelVersionState.DRAFT,
        )
        repo.add_product_model_version(db, initial)
        db.flush()
        _append_history(
            db,
            row.id,
            f"Скопировано из модели #{source.id} ({source.article})",
        )
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise ProductModelArticleConflictError("Модель с таким артикулом уже существует") from error
    db.refresh(row)
    return row


def list_product_model_versions(db: Session, model_id: int) -> list[ProductModelVersion]:
    get_product_model(db, model_id)
    return repo.list_product_model_versions(db, model_id)


def get_product_model_version(db: Session, model_id: int, version_id: int) -> ProductModelVersion:
    get_product_model(db, model_id)
    version = repo.get_product_model_version(db, version_id)
    if version is None or version.product_model_id != model_id:
        raise ProductModelVersionNotFoundError("Версия модели не найдена")
    return version


def create_product_model_version(
    db: Session,
    model_id: int,
    payload: ProductModelVersionCreate,
) -> ProductModelVersion:
    get_product_model(db, model_id)

    source_note: str | None = payload.note
    source_label: str | None = payload.label
    if payload.source_version_id is not None:
        source = get_product_model_version(db, model_id, payload.source_version_id)
        if source_note is None:
            source_note = source.note
        if source_label is None and source.label:
            source_label = f"{source.label} (черновик)"

    version_number = repo.next_version_number(db, model_id)
    row = ProductModelVersion(
        product_model_id=model_id,
        version_number=version_number,
        label=source_label or f"v{version_number}",
        state=ProductModelVersionState.DRAFT,
        note=source_note,
    )
    repo.add_product_model_version(db, row)
    _append_history(db, model_id, f"Создана версия {row.label or row.version_number}")
    db.commit()
    db.refresh(row)
    return row


def publish_product_model_version(db: Session, model_id: int, version_id: int) -> ProductModelVersion:
    version = get_product_model_version(db, model_id, version_id)
    if version.state == ProductModelVersionState.PUBLISHED:
        return version
    if version.state == ProductModelVersionState.ARCHIVED:
        raise ProductModelValidationError("Нельзя опубликовать архивную версию")

    current_published = repo.get_published_version(db, model_id)
    if current_published is not None and current_published.id != version.id:
        current_published.state = ProductModelVersionState.ARCHIVED

    version.state = ProductModelVersionState.PUBLISHED
    version.published_at = datetime.now(timezone.utc)
    _append_history(db, model_id, f"Опубликована версия {version.label or version.version_number}")
    db.commit()
    db.refresh(version)
    return version


def archive_product_model_version(db: Session, model_id: int, version_id: int) -> ProductModelVersion:
    version = get_product_model_version(db, model_id, version_id)
    if version.state == ProductModelVersionState.ARCHIVED:
        return version
    version.state = ProductModelVersionState.ARCHIVED
    _append_history(db, model_id, f"Архивирована версия {version.label or version.version_number}")
    db.commit()
    db.refresh(version)
    return version


def _append_history(
    db: Session,
    model_id: int,
    action: str,
    *,
    actor: str = DEFAULT_ACTOR,
) -> ProductModelHistoryEntry:
    while repo.count_product_model_history(db, model_id) >= HISTORY_LIMIT:
        oldest = repo.oldest_product_model_history(db, model_id)
        if oldest is None:
            break
        db.delete(oldest)
        db.flush()
    entry = ProductModelHistoryEntry(
        product_model_id=model_id,
        actor=actor,
        action=action,
    )
    db.add(entry)
    db.flush()
    return entry


def list_product_model_history(db: Session, model_id: int) -> list[ProductModelHistoryEntry]:
    get_product_model(db, model_id)
    return repo.list_product_model_history(db, model_id)


def media_content_url(model_id: int, media_id: int) -> str:
    return f"/product-models/{model_id}/media/{media_id}/content"


def _safe_media_filename(filename: str) -> str:
    name = Path(filename).name.strip()
    if not name or name in {".", ".."}:
        raise ProductModelValidationError("Некорректное имя файла изображения")
    return re.sub(r"[^A-Za-z0-9._-]", "_", name)[:255]


def _decode_image(content: str) -> bytes:
    try:
        data = base64.b64decode(content, validate=True)
    except (binascii.Error, ValueError) as error:
        raise ProductModelValidationError("Некорректное содержимое изображения") from error
    if not data or len(data) > MAX_COVER_SIZE:
        raise ProductModelValidationError("Размер изображения должен быть от 1 байта до 10 МБ")
    return data


def _delete_media_file(storage_key: str | None) -> None:
    if not storage_key:
        return
    path = (MEDIA_ROOT / storage_key).resolve()
    if MEDIA_ROOT not in path.parents:
        raise ProductModelValidationError("Небезопасный путь изображения")
    if path.exists():
        path.unlink()


def _delete_cover_file(storage_key: str | None) -> None:
    if not storage_key:
        return
    path = (COVER_ROOT / storage_key).resolve()
    if COVER_ROOT not in path.parents:
        raise ProductModelValidationError("Небезопасный путь обложки")
    if path.exists():
        path.unlink()


def _clear_primary_flags(db: Session, model_id: int, *, except_id: int | None = None) -> None:
    for item in repo.list_product_model_media(db, model_id):
        if except_id is not None and item.id == except_id:
            continue
        if item.is_primary:
            item.is_primary = False


def _sync_cover_from_primary(db: Session, model: ProductModel) -> None:
    primary = repo.get_primary_media(db, model.id)
    if primary is None:
        model.cover_image_url = None
        return
    model.cover_image_url = media_content_url(model.id, primary.id)


def list_product_model_media(db: Session, model_id: int) -> list[ProductModelMedia]:
    get_product_model(db, model_id)
    return repo.list_product_model_media(db, model_id)


def get_product_model_media(db: Session, model_id: int, media_id: int) -> ProductModelMedia:
    get_product_model(db, model_id)
    item = repo.get_product_model_media(db, media_id)
    if item is None or item.product_model_id != model_id:
        raise ProductModelNotFoundError("Изображение модели не найдено")
    return item


def add_product_model_media(
    db: Session,
    model_id: int,
    payload: ProductModelMediaCreate,
) -> ProductModelMedia:
    row = get_product_model(db, model_id)
    data = _decode_image(payload.content_base64)
    filename = _safe_media_filename(payload.filename)
    key = f"{model_id}/{uuid.uuid4().hex}-{filename}"
    path = MEDIA_ROOT / key
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)

    existing = repo.list_product_model_media(db, model_id)
    make_primary = payload.is_primary or len(existing) == 0
    if make_primary:
        _clear_primary_flags(db, model_id)

    item = ProductModelMedia(
        product_model_id=model_id,
        filename=filename,
        storage_key=key,
        mime_type=payload.mime_type,
        file_size=len(data),
        sort_order=repo.next_media_sort_order(db, model_id),
        is_primary=make_primary,
    )
    repo.add_product_model_media(db, item)
    _sync_cover_from_primary(db, row)
    _append_history(db, model_id, f"Добавлено фото: {filename}")
    db.commit()
    db.refresh(item)
    return item


def set_product_model_media_primary(
    db: Session,
    model_id: int,
    media_id: int,
) -> ProductModelMedia:
    row = get_product_model(db, model_id)
    item = get_product_model_media(db, model_id, media_id)
    if not item.is_primary:
        _clear_primary_flags(db, model_id, except_id=item.id)
        item.is_primary = True
        _sync_cover_from_primary(db, row)
        _append_history(db, model_id, f"Основное фото: {item.filename}")
        db.commit()
        db.refresh(item)
    return item


def delete_product_model_media(db: Session, model_id: int, media_id: int) -> None:
    row = get_product_model(db, model_id)
    item = get_product_model_media(db, model_id, media_id)
    was_primary = item.is_primary
    filename = item.filename
    storage_key = item.storage_key
    db.delete(item)
    db.flush()

    if was_primary:
        remaining = repo.list_product_model_media(db, model_id)
        if remaining:
            remaining[0].is_primary = True
    _sync_cover_from_primary(db, row)
    _append_history(db, model_id, f"Удалено фото: {filename}")
    db.commit()
    try:
        _delete_media_file(storage_key)
    except ProductModelValidationError:
        pass


def product_model_media_path(db: Session, model_id: int, media_id: int) -> tuple[Path, str]:
    item = get_product_model_media(db, model_id, media_id)
    path = (MEDIA_ROOT / item.storage_key).resolve()
    if MEDIA_ROOT not in path.parents or not path.exists():
        raise ProductModelNotFoundError("Файл изображения не найден")
    return path, item.mime_type


def upload_product_model_cover(
    db: Session,
    model_id: int,
    payload: ProductModelCoverUpload,
) -> ProductModel:
    """Compatibility: store cover as primary gallery image."""
    add_product_model_media(
        db,
        model_id,
        ProductModelMediaCreate(
            filename=payload.filename,
            mime_type=payload.mime_type,
            content_base64=payload.content_base64,
            is_primary=True,
        ),
    )
    return get_product_model(db, model_id)


def delete_product_model_cover(db: Session, model_id: int) -> ProductModel:
    """Compatibility: remove primary gallery image (or legacy cover file)."""
    row = get_product_model(db, model_id)
    primary = repo.get_primary_media(db, model_id)
    if primary is not None:
        delete_product_model_media(db, model_id, primary.id)
        return get_product_model(db, model_id)

    previous_key = row.cover_storage_key
    row.cover_storage_key = None
    row.cover_mime_type = None
    row.cover_image_url = None
    if previous_key:
        _append_history(db, model_id, "Удалена обложка")
    db.commit()
    db.refresh(row)
    _delete_cover_file(previous_key)
    return row


def product_model_cover_path(db: Session, model_id: int) -> tuple[Path, str]:
    primary = repo.get_primary_media(db, model_id)
    if primary is not None:
        return product_model_media_path(db, model_id, primary.id)

    row = get_product_model(db, model_id)
    if not row.cover_storage_key or not row.cover_mime_type:
        raise ProductModelNotFoundError("Обложка модели не найдена")
    path = (COVER_ROOT / row.cover_storage_key).resolve()
    if COVER_ROOT not in path.parents or not path.exists():
        raise ProductModelNotFoundError("Файл обложки не найден")
    return path, row.cover_mime_type
