"""Stage 23.1.3 — task-media storage helper."""

from __future__ import annotations

from pathlib import Path

import pytest

from app.services.work_task_media import (
    ALLOWED_TASK_IMAGE_MIMES,
    WorkTaskMediaError,
    assert_allowed_task_image_mime,
    build_task_attachment_storage_key,
    resolve_task_attachment_path,
    write_task_attachment_bytes,
)


def test_build_storage_key_under_task_id() -> None:
    key = build_task_attachment_storage_key(42, "../evil name.png")
    assert key.startswith("42/")
    assert ".." not in Path(key).parts
    assert key.endswith("-evil_name.png")


def test_allowed_image_mimes() -> None:
    assert "image/jpeg" in ALLOWED_TASK_IMAGE_MIMES
    assert_allowed_task_image_mime("image/png")
    with pytest.raises(WorkTaskMediaError):
        assert_allowed_task_image_mime("application/pdf")


def test_resolve_rejects_path_escape(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "app.services.work_task_media.TASK_MEDIA_ROOT",
        tmp_path.resolve(),
    )
    with pytest.raises(WorkTaskMediaError):
        resolve_task_attachment_path("../outside.txt")


def test_write_bytes_roundtrip(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "app.services.work_task_media.TASK_MEDIA_ROOT",
        tmp_path.resolve(),
    )
    key = build_task_attachment_storage_key(7, "shot.jpg")
    path = write_task_attachment_bytes(key, b"hello-image")
    assert path.exists()
    assert path.read_bytes() == b"hello-image"
    assert tmp_path.resolve() in path.resolve().parents
