"""Unit-line personalization import template download."""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app
from app.services.technical_cards import unit_lines_import_template_path


def test_unit_lines_import_template_file_exists() -> None:
    path = unit_lines_import_template_path()
    assert path.name == "techcart_example.xlsx"
    assert path.stat().st_size > 0


def test_download_unit_lines_import_template_endpoint() -> None:
    with TestClient(app) as client:
        response = client.get("/technical-cards/unit-lines/import-template")
    assert response.status_code == 200, response.text
    assert (
        "spreadsheetml.sheet" in (response.headers.get("content-type") or "")
        or response.headers.get("content-type") == "application/octet-stream"
    )
    assert response.content[:2] == b"PK"  # zip/xlsx magic
    disposition = response.headers.get("content-disposition") or ""
    assert "techcart_example.xlsx" in disposition
