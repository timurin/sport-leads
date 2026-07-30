"""Stage 4.5.1.1 — shared tabular file I/O helpers (no section SoT)."""

from __future__ import annotations

import io

import pytest
from openpyxl import Workbook

from app.schemas.file_io import FileIoRowError
from app.services.file_io import (
    FileIoParseError,
    build_dry_run_envelope,
    detect_tabular_format,
    parse_tabular_bytes,
    remap_row,
    require_columns,
    validate_rows,
)


def _xlsx_bytes(rows: list[list[object]], sheet_name: str = "Sheet1") -> bytes:
    wb = Workbook()
    ws = wb.active
    assert ws is not None
    ws.title = sheet_name
    for row in rows:
        ws.append(row)
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def test_detect_format_from_filename_and_content_type() -> None:
    assert detect_tabular_format(filename="items.csv") == "csv"
    assert detect_tabular_format(filename="items.XLSX") == "xlsx"
    assert (
        detect_tabular_format(
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
        == "xlsx"
    )
    with pytest.raises(FileIoParseError):
        detect_tabular_format(filename="items.bin")


def test_parse_csv_semicolon_and_empty_cells() -> None:
    raw = "name;unit;price\nShirt;pcs;1500\n;;\nTank;;\n".encode("utf-8")
    table = parse_tabular_bytes(raw, filename="n.csv")
    assert table.source_format == "csv"
    assert table.headers == ["name", "unit", "price"]
    assert len(table.rows) == 2
    assert table.rows[0]["name"] == "Shirt"
    assert table.rows[1]["unit"] is None
    assert table.rows[1]["price"] is None


def test_parse_xlsx_and_sheet_name() -> None:
    data = _xlsx_bytes(
        [
            ["name", "code"],
            ["A", "1"],
            ["", ""],
            ["B", "2"],
        ],
        sheet_name="Catalog",
    )
    table = parse_tabular_bytes(data, filename="c.xlsx", sheet_name="Catalog")
    assert table.source_format == "xlsx"
    assert table.sheet_name == "Catalog"
    assert [r["name"] for r in table.rows] == ["A", "B"]


def test_require_columns_and_validate_rows() -> None:
    table = parse_tabular_bytes(
        b"name,unit\nOk,pcs\n,pcs\n",
        filename="a.csv",
    )
    header_errors = require_columns(table.headers, ["name", "type"])
    assert header_errors[0].code == "missing_column"
    assert header_errors[0].row_number == 0

    def require_name(row_number: int, row: dict[str, str | None]) -> list[FileIoRowError]:
        if not row.get("name"):
            return [
                FileIoRowError(
                    row_number=row_number,
                    column="name",
                    code="required",
                    message="name is required",
                )
            ]
        return []

    row_errors = validate_rows(table.rows, [require_name])
    assert len(row_errors) == 1
    assert row_errors[0].row_number == 2


def test_dry_run_envelope_blocks_on_errors() -> None:
    errors = [
        FileIoRowError(row_number=1, column="name", code="required", message="x"),
        FileIoRowError(row_number=1, column="unit", code="required", message="y"),
        FileIoRowError(row_number=3, column="name", code="required", message="z"),
    ]
    envelope = build_dry_run_envelope(
        total_rows=3,
        errors=errors,
        preview=[{"name": "ok"}],
        dry_run=True,
    )
    assert envelope.error_rows == 2
    assert envelope.valid_rows == 1
    assert envelope.can_commit is False
    assert envelope.preview == [{"name": "ok"}]

    ok = build_dry_run_envelope(total_rows=2, errors=[], preview=[{"a": 1}, {"b": 2}])
    assert ok.can_commit is True
    assert ok.valid_rows == 2


def test_dry_run_header_error_blocks_commit() -> None:
    envelope = build_dry_run_envelope(
        total_rows=5,
        errors=[
            FileIoRowError(
                row_number=0,
                column="type",
                code="missing_column",
                message="missing",
            )
        ],
    )
    assert envelope.can_commit is False


def test_remap_row() -> None:
    mapped = remap_row(
        {"Name": "X", "Unit": "pcs"},
        {"name": "name", "unit": "unit"},
    )
    assert mapped == {"name": "X", "unit": "pcs"}


def test_empty_file_raises() -> None:
    with pytest.raises(FileIoParseError):
        parse_tabular_bytes(b"", filename="a.csv")


def test_render_csv_skips_sep_hint_on_reimport_and_keeps_pipe_lists() -> None:
    from app.services.file_io import render_csv_bytes

    payload = render_csv_bytes(
        ["name", "photo_paths", "created_at"],
        [
            {
                "name": "Item",
                "photo_paths": (
                    r"D:\a\one.jpg|D:\a\two.jpg|D:\a\three.jpg"
                ),
                "created_at": "2024-07-23T14:10:29+02:00",
            }
        ],
    )
    text = payload.decode("utf-8-sig")
    assert text.startswith("sep=,")
    table = parse_tabular_bytes(payload, filename="e.csv")
    assert table.headers == ["name", "photo_paths", "created_at"]
    assert table.rows[0]["photo_paths"] == r"D:\a\one.jpg|D:\a\two.jpg|D:\a\three.jpg"
    assert table.rows[0]["created_at"] == "2024-07-23T14:10:29+02:00"
    # Excel-RU style mis-parse would put second path into created_at — guard against that.
    assert "two.jpg" not in (table.rows[0]["created_at"] or "")
