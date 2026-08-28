"""Shared sewing-operation catalog file columns (import ↔ export / template).

Roadmap `4.5.4` / ADR-020 contour A — third catalog adapter.
Amended `26.10.3`: drop catalog economics; add `description`.
"""

from __future__ import annotations

# Prefer `|` — Excel (RU) treats `;` as CSV column delimiter.
LIST_VALUE_SEPARATOR = "|"

# Hierarchy in `folder_path`. Folder names must not contain this substring.
FOLDER_PATH_SEPARATOR = " / "

SEWING_OPERATION_FILE_HEADERS: tuple[str, ...] = (
    "id",
    "name",
    "description",
    "folder_path",
    "sort_order",
    "work_center_codes",
    "created_at",
    "updated_at",
)

SEWING_OPERATION_TEMPLATE_SAMPLE_ROWS: tuple[dict[str, str], ...] = (
    {
        "id": "",
        "name": "Стачивание бокового шва",
        "description": "Боковой шов",
        "folder_path": "Пошив / Швы",
        "sort_order": "",
        "work_center_codes": "OV-1",
        "created_at": "",
        "updated_at": "",
    },
    {
        "id": "",
        "name": "Обметать срез",
        "description": "",
        "folder_path": "",
        "sort_order": "",
        "work_center_codes": "",
        "created_at": "",
        "updated_at": "",
    },
)
