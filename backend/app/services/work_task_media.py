"""Work-task attachment storage helpers (ADR-028 / 23.1.3)."""

from __future__ import annotations

import re
import uuid
from pathlib import Path

TASK_MEDIA_ROOT = Path("storage/task-media").resolve()
MAX_TASK_ATTACHMENT_BYTES = 10 * 1024 * 1024

ALLOWED_TASK_IMAGE_MIMES = frozenset(
    {
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/gif",
    }
)


class WorkTaskMediaError(RuntimeError):
    pass


def ensure_task_media_root() -> Path:
    TASK_MEDIA_ROOT.mkdir(parents=True, exist_ok=True)
    return TASK_MEDIA_ROOT


def assert_allowed_task_image_mime(mime_type: str) -> None:
    if mime_type not in ALLOWED_TASK_IMAGE_MIMES:
        raise WorkTaskMediaError(f"Unsupported task attachment mime type: {mime_type}")


def safe_attachment_filename(filename: str) -> str:
    name = Path(filename).name.strip()
    if not name or name in {".", ".."}:
        raise WorkTaskMediaError("Invalid attachment filename")
    return re.sub(r"[^A-Za-z0-9._-]", "_", name)[:255]


def build_task_attachment_storage_key(task_id: int, original_filename: str) -> str:
    safe = safe_attachment_filename(original_filename)
    return f"{int(task_id)}/{uuid.uuid4().hex}-{safe}"


def resolve_task_attachment_path(storage_key: str) -> Path:
    """Resolve storage_key under TASK_MEDIA_ROOT; reject path escape."""
    ensure_task_media_root()
    candidate = (TASK_MEDIA_ROOT / storage_key).resolve()
    if TASK_MEDIA_ROOT not in candidate.parents and candidate != TASK_MEDIA_ROOT:
        raise WorkTaskMediaError("Unsafe task attachment storage path")
    return candidate


def write_task_attachment_bytes(storage_key: str, data: bytes) -> Path:
    if not data or len(data) > MAX_TASK_ATTACHMENT_BYTES:
        raise WorkTaskMediaError("Attachment size must be between 1 byte and 10 MB")
    path = resolve_task_attachment_path(storage_key)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    return path
