from __future__ import annotations

import base64
import binascii
import re
import uuid
from pathlib import Path

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.models.media import NomenclatureMedia
from app.models.nomenclature import Nomenclature
from app.schemas.media import NomenclatureMediaCreate, NomenclatureMediaUpdate

MEDIA_ROOT = Path("storage/nomenclature-media").resolve()
MAX_FILE_SIZE = 10 * 1024 * 1024


class MediaError(RuntimeError):
    pass


def _nomenclature(db: Session, nomenclature_id: int) -> None:
    if db.get(Nomenclature, nomenclature_id) is None:
        raise MediaError("Nomenclature not found")


def _safe_filename(filename: str) -> str:
    name = Path(filename).name.strip()
    if not name or name in {".", ".."}:
        raise MediaError("Invalid media filename")
    return re.sub(r"[^A-Za-z0-9._-]", "_", name)[:255]


def _decode(content: str) -> bytes:
    try:
        data = base64.b64decode(content, validate=True)
    except (binascii.Error, ValueError) as error:
        raise MediaError("Invalid base64 media content") from error
    if not data or len(data) > MAX_FILE_SIZE:
        raise MediaError("Media file size must be between 1 byte and 10 MB")
    return data


def _set_primary(db: Session, nomenclature_id: int, media_id: int | None = None) -> None:
    query = update(NomenclatureMedia).where(NomenclatureMedia.nomenclature_id == nomenclature_id)
    if media_id is not None:
        query = query.where(NomenclatureMedia.id != media_id)
    db.execute(query.values(is_primary=False))


def list_media(db: Session, nomenclature_id: int) -> list[NomenclatureMedia]:
    _nomenclature(db, nomenclature_id)
    return list(db.scalars(select(NomenclatureMedia).where(NomenclatureMedia.nomenclature_id == nomenclature_id).order_by(NomenclatureMedia.sort_order, NomenclatureMedia.id)).all())


def create_media(db: Session, nomenclature_id: int, payload: NomenclatureMediaCreate) -> NomenclatureMedia:
    _nomenclature(db, nomenclature_id)
    data = _decode(payload.content_base64)
    filename = _safe_filename(payload.filename)
    key = f"nomenclature/{nomenclature_id}/{uuid.uuid4().hex}-{filename}"
    path = MEDIA_ROOT / key
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    if payload.is_primary:
        _set_primary(db, nomenclature_id)
    item = NomenclatureMedia(nomenclature_id=nomenclature_id, filename=filename, storage_key=key, mime_type=payload.mime_type, file_size=len(data), alt_text=payload.alt_text, sort_order=payload.sort_order, is_primary=payload.is_primary)
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def update_media(db: Session, nomenclature_id: int, media_id: int, payload: NomenclatureMediaUpdate) -> NomenclatureMedia:
    item = db.scalar(select(NomenclatureMedia).where(NomenclatureMedia.id == media_id, NomenclatureMedia.nomenclature_id == nomenclature_id))
    if item is None:
        raise MediaError("Media not found")
    changes = payload.model_dump(exclude_unset=True)
    if changes.get("is_primary"):
        _set_primary(db, nomenclature_id, media_id)
    for key, value in changes.items():
        setattr(item, key, value)
    db.commit()
    db.refresh(item)
    return item


def delete_media(db: Session, nomenclature_id: int, media_id: int) -> None:
    item = db.scalar(select(NomenclatureMedia).where(NomenclatureMedia.id == media_id, NomenclatureMedia.nomenclature_id == nomenclature_id))
    if item is None:
        raise MediaError("Media not found")
    path = (MEDIA_ROOT / item.storage_key).resolve()
    if MEDIA_ROOT not in path.parents:
        raise MediaError("Unsafe media storage path")
    if path.exists():
        path.unlink()
    db.delete(item)
    db.commit()


def media_path(item: NomenclatureMedia) -> Path:
    path = (MEDIA_ROOT / item.storage_key).resolve()
    if MEDIA_ROOT not in path.parents or not path.exists():
        raise MediaError("Media content not found")
    return path
