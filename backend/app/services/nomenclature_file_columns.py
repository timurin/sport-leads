"""Shared nomenclature catalog file columns (import ↔ export / template).

Roadmap `4.5.1` / `4.5.2` / ADR-020 — one header contract for both directions.
Characteristics use dynamic headers `char:<code>`.
"""

from __future__ import annotations

CHAR_COLUMN_PREFIX = "char:"

# Fixed columns (core card + links). Dynamic char:* appended on export.
NOMENCLATURE_FILE_HEADERS: tuple[str, ...] = (
    "id",
    "name",
    "short_name",
    "description",
    "category",
    "category_code",
    "category_path",
    "nomenclature_type",
    "product_type_name",
    "unit",
    "storage_unit_code",
    "base_price",
    "currency",
    "is_active",
    "product_model_articles",
    "photo_paths",
    "photo_urls",
    "created_at",
    "updated_at",
)

# Example rows for import template (same fixed columns as export).
NOMENCLATURE_TEMPLATE_SAMPLE_ROWS: tuple[dict[str, str], ...] = (
    {
        "id": "",
        "name": "Футболка базовая",
        "short_name": "Футб.",
        "description": "Пример — замените на свои данные или удалите строку",
        "category": "Форма",
        "category_code": "",
        "category_path": "Каталог / Форма",
        "nomenclature_type": "PRODUCT",
        "product_type_name": "",
        "unit": "шт",
        "storage_unit_code": "",
        "base_price": "1500.00",
        "currency": "RUB",
        "is_active": "true",
        "product_model_articles": "",
        "photo_paths": "",
        "photo_urls": "",
        "created_at": "",
        "updated_at": "",
        f"{CHAR_COLUMN_PREFIX}color": "",
        f"{CHAR_COLUMN_PREFIX}size": "",
    },
    {
        "id": "",
        "name": "Ткань кулир",
        "short_name": "",
        "description": "",
        "category": "Материалы",
        "category_code": "",
        "category_path": "Каталог / Материалы",
        "nomenclature_type": "MATERIAL",
        "product_type_name": "",
        "unit": "м",
        "storage_unit_code": "",
        "base_price": "320.50",
        "currency": "RUB",
        "is_active": "true",
        "product_model_articles": "",
        "photo_paths": "",
        "photo_urls": "",
        "created_at": "",
        "updated_at": "",
        f"{CHAR_COLUMN_PREFIX}color": "",
        f"{CHAR_COLUMN_PREFIX}size": "",
    },
)

NOMENCLATURE_TEMPLATE_CHAR_CODES: tuple[str, ...] = ("color", "size")


def char_column_name(code: str) -> str:
    return f"{CHAR_COLUMN_PREFIX}{code.strip()}"


def parse_char_column_header(header: str) -> str | None:
    raw = header.strip()
    lower = raw.lower()
    if lower.startswith(CHAR_COLUMN_PREFIX):
        code = raw[len(CHAR_COLUMN_PREFIX) :].strip()
        return code or None
    if lower.startswith("характеристика:"):
        code = raw.split(":", 1)[1].strip()
        return code or None
    return None


def build_file_headers(characteristic_codes: list[str] | tuple[str, ...] = ()) -> list[str]:
    headers = list(NOMENCLATURE_FILE_HEADERS)
    for code in characteristic_codes:
        cleaned = code.strip()
        if cleaned:
            headers.append(char_column_name(cleaned))
    return headers
