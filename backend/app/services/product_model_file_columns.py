"""Shared product-model catalog file columns (import ↔ export / template).

Roadmap `4.5.3` / ADR-020 contour A — second catalog adapter after nomenclature.
"""

from __future__ import annotations

# Prefer `|` — Excel (RU) treats `;` as CSV column delimiter.
LIST_VALUE_SEPARATOR = "|"

PRODUCT_MODEL_FILE_HEADERS: tuple[str, ...] = (
    "id",
    "article",
    "name",
    "size_type",
    "size_grid_name",
    "product_type_name",
    "description",
    "patterns_path",
    "constructor_name",
    "patterns_created_on",
    "default_routing_code",
    "assembly_variant_ids",
    "routing_template_ids",
    "photo_paths",
    "photo_urls",
    "status",
    "created_at",
    "updated_at",
)

PRODUCT_MODEL_TEMPLATE_SAMPLE_ROWS: tuple[dict[str, str], ...] = (
    {
        "id": "",
        "article": "PM-001",
        "name": "Футболка базовая",
        "size_type": "men",
        "size_grid_name": "",
        "product_type_name": "",
        "description": "Пример — замените или удалите строку",
        "patterns_path": "",
        "constructor_name": "",
        "patterns_created_on": "",
        "default_routing_code": "",
        "assembly_variant_ids": "",
        "routing_template_ids": "",
        "photo_paths": "",
        "photo_urls": "",
        "status": "draft",
        "created_at": "",
        "updated_at": "",
    },
    {
        "id": "",
        "article": "PM-002",
        "name": "Шорты тренировочные",
        "size_type": "women",
        "size_grid_name": "",
        "product_type_name": "",
        "description": "",
        "patterns_path": "",
        "constructor_name": "",
        "patterns_created_on": "",
        "default_routing_code": "",
        "assembly_variant_ids": "",
        "routing_template_ids": "",
        "photo_paths": "",
        "photo_urls": "",
        "status": "draft",
        "created_at": "",
        "updated_at": "",
    },
)
