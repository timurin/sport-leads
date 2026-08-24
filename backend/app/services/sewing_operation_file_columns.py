"""Shared sewing-operation catalog file columns (import ↔ export / template).

Roadmap `4.5.4` / ADR-020 contour A — third catalog adapter.
"""

from __future__ import annotations

# Prefer `|` — Excel (RU) treats `;` as CSV column delimiter.
LIST_VALUE_SEPARATOR = "|"

# Hierarchy in `folder_path`. Folder names must not contain this substring.
FOLDER_PATH_SEPARATOR = " / "

SEWING_OPERATION_FILE_HEADERS: tuple[str, ...] = (
    "id",
    "name",
    "cost",
    "quantity_per_item",
    "duration_seconds",
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
        "cost": "50.00",
        "quantity_per_item": "1",
        "duration_seconds": "90",
        "folder_path": "Пошив / Швы",
        "sort_order": "",
        "work_center_codes": "OV-1",
        "created_at": "",
        "updated_at": "",
    },
    {
        "id": "",
        "name": "Обметать срез",
        "cost": "25.50",
        "quantity_per_item": "2",
        "duration_seconds": "45",
        "folder_path": "",
        "sort_order": "",
        "work_center_codes": "",
        "created_at": "",
        "updated_at": "",
    },
)
