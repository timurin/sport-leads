from __future__ import annotations

from sqlalchemy.orm import Session, selectinload

from app.models.size_grid import SizeGrid, SizeGridRow, SizeGridSizeType

MOSMADE_SOURCE_NOTE = "https://mosmade.ru/about/tablitsy-razmerov/"
MOSMADE_MEN_GRID_NAME = "Мужская (Mosmade)"
MOSMADE_WOMEN_GRID_NAME = "Женская (Mosmade)"

# Mosmade men table — reference text cells; "-" → null for height groups.
MOSMADE_MEN_ROWS: list[dict[str, str | int | None]] = [
    {"sort_order": 0, "ru_size": "26", "int_label": "116", "chest": "52-56", "waist": "52-54", "hip": "56-60", "height_s": None, "height_n": "110-116", "height_t": None},
    {"sort_order": 1, "ru_size": "28", "int_label": "122", "chest": "56-60", "waist": "56-58", "hip": "60-64", "height_s": None, "height_n": "116-122", "height_t": None},
    {"sort_order": 2, "ru_size": "30", "int_label": "128", "chest": "60-64", "waist": "58-60", "hip": "64-68", "height_s": None, "height_n": "122-128", "height_t": None},
    {"sort_order": 3, "ru_size": "32", "int_label": "134", "chest": "64-68", "waist": "60-62", "hip": "68-72", "height_s": None, "height_n": "128-134", "height_t": None},
    {"sort_order": 4, "ru_size": "34", "int_label": "140", "chest": "68-70", "waist": "62-66", "hip": "72-76", "height_s": None, "height_n": "134-140", "height_t": None},
    {"sort_order": 5, "ru_size": "36", "int_label": "146", "chest": "70-74", "waist": "66-68", "hip": "76-80", "height_s": None, "height_n": "140-146", "height_t": None},
    {"sort_order": 6, "ru_size": "38", "int_label": "152", "chest": "74-78", "waist": "68-70", "hip": "80-84", "height_s": None, "height_n": "146-152", "height_t": None},
    {"sort_order": 7, "ru_size": "40", "int_label": "158", "chest": "78-82", "waist": "70-72", "hip": "84-88", "height_s": None, "height_n": "152-158", "height_t": None},
    {"sort_order": 8, "ru_size": "42", "int_label": "164", "chest": "82-88", "waist": "72-76", "hip": "88-92", "height_s": None, "height_n": "158-164", "height_t": None},
    {"sort_order": 9, "ru_size": "44", "int_label": "XS", "chest": "88-92", "waist": "76-80", "hip": "92-96", "height_s": None, "height_n": "158-164", "height_t": "164-170"},
    {"sort_order": 10, "ru_size": "46", "int_label": "S", "chest": "92-96", "waist": "80-84", "hip": "96-99", "height_s": "158-164", "height_n": "164-170", "height_t": "170-176"},
    {"sort_order": 11, "ru_size": "48", "int_label": "M", "chest": "96-100", "waist": "84-88", "hip": "99-102", "height_s": "170-176", "height_n": "176-182", "height_t": "182-188"},
    {"sort_order": 12, "ru_size": "50", "int_label": "L", "chest": "100-104", "waist": "88-92", "hip": "102-105", "height_s": "170-176", "height_n": "176-182", "height_t": "182-188"},
    {"sort_order": 13, "ru_size": "52", "int_label": "XL", "chest": "104-108", "waist": "92-96", "hip": "105-108", "height_s": "176-182", "height_n": "182-188", "height_t": "188-194"},
    {"sort_order": 14, "ru_size": "54", "int_label": "2XL", "chest": "108-112", "waist": "96-100", "hip": "108-111", "height_s": "176-182", "height_n": "182-188", "height_t": "188-194"},
    {"sort_order": 15, "ru_size": "56", "int_label": "3XL", "chest": "112-116", "waist": "100-108", "hip": "111-117", "height_s": "176-182", "height_n": "182-188", "height_t": "188-194"},
    {"sort_order": 16, "ru_size": "58", "int_label": "4XL", "chest": "116-120", "waist": "108-116", "hip": "117-123", "height_s": "176-182", "height_n": "182-188", "height_t": "188-194"},
    {"sort_order": 17, "ru_size": "60", "int_label": "5XL", "chest": "120-124", "waist": "116-124", "hip": "123-129", "height_s": "176-182", "height_n": "182-188", "height_t": "188-194"},
]

# Mosmade women table.
MOSMADE_WOMEN_ROWS: list[dict[str, str | int | None]] = [
    {"sort_order": 0, "ru_size": "28", "int_label": "122", "chest": "56-60", "waist": "56-58", "hip": "60-64", "height_s": None, "height_n": "122-128", "height_t": None},
    {"sort_order": 1, "ru_size": "30", "int_label": "128", "chest": "60-64", "waist": "58-60", "hip": "64-68", "height_s": None, "height_n": "128-134", "height_t": None},
    {"sort_order": 2, "ru_size": "32", "int_label": "134", "chest": "64-68", "waist": "60-62", "hip": "68-72", "height_s": None, "height_n": "134-140", "height_t": None},
    {"sort_order": 3, "ru_size": "34", "int_label": "140", "chest": "68-70", "waist": "62-64", "hip": "72-76", "height_s": None, "height_n": "140-146", "height_t": None},
    {"sort_order": 4, "ru_size": "36", "int_label": "146", "chest": "70-74", "waist": "66-68", "hip": "76-80", "height_s": None, "height_n": "146-152", "height_t": None},
    {"sort_order": 5, "ru_size": "38", "int_label": "152", "chest": "74-78", "waist": "68-70", "hip": "80-84", "height_s": None, "height_n": "152-158", "height_t": None},
    {"sort_order": 6, "ru_size": "40", "int_label": "158", "chest": "78-82", "waist": "70-72", "hip": "84-88", "height_s": None, "height_n": "158-164", "height_t": "164-170"},
    {"sort_order": 7, "ru_size": "42", "int_label": "XS", "chest": "82-86", "waist": "72-74", "hip": "88-92", "height_s": "158-164", "height_n": "164-170", "height_t": "170-176"},
    {"sort_order": 8, "ru_size": "44", "int_label": "S", "chest": "86-90", "waist": "74-78", "hip": "92-96", "height_s": "164-170", "height_n": "170-176", "height_t": "176-182"},
    {"sort_order": 9, "ru_size": "46", "int_label": "M", "chest": "90-94", "waist": "78-82", "hip": "96-100", "height_s": "170-176", "height_n": "176-182", "height_t": "182-188"},
    {"sort_order": 10, "ru_size": "48", "int_label": "L", "chest": "94-98", "waist": "82-86", "hip": "100-104", "height_s": "170-176", "height_n": "176-182", "height_t": "182-188"},
    {"sort_order": 11, "ru_size": "50", "int_label": "XL", "chest": "98-102", "waist": "86-90", "hip": "104-108", "height_s": "170-176", "height_n": "176-182", "height_t": "182-188"},
    {"sort_order": 12, "ru_size": "52", "int_label": "2XL", "chest": "102-106", "waist": "90-94", "hip": "108-112", "height_s": "170-176", "height_n": "176-182", "height_t": "182-188"},
    {"sort_order": 13, "ru_size": "54", "int_label": "3XL", "chest": "106-110", "waist": "94-98", "hip": "112-116", "height_s": "170-176", "height_n": "176-182", "height_t": "182-188"},
]

# Compatibility alias for first-row tests / docs.
MOSMADE_MEN_ROW_46_S = next(
    row for row in MOSMADE_MEN_ROWS if row["ru_size"] == "46" and row["int_label"] == "S"
)


def _replace_rows(
    db: Session,
    grid: SizeGrid,
    rows: list[dict[str, str | int | None]],
) -> None:
    # Explicit delete+flush so unique (grid, ru, int) does not clash on insert.
    db.query(SizeGridRow).filter(SizeGridRow.size_grid_id == grid.id).delete()
    db.flush()
    for payload in rows:
        db.add(SizeGridRow(size_grid_id=grid.id, **payload))  # type: ignore[arg-type]


def _ensure_grid(
    db: Session,
    *,
    name: str,
    size_type: SizeGridSizeType,
    rows: list[dict[str, str | int | None]],
) -> SizeGrid:
    grid = (
        db.query(SizeGrid)
        .options(selectinload(SizeGrid.rows))
        .filter(SizeGrid.name == name)
        .one_or_none()
    )
    if grid is None:
        grid = SizeGrid(
            name=name,
            size_type=size_type,
            source_note=MOSMADE_SOURCE_NOTE,
        )
        db.add(grid)
        db.flush()
    else:
        grid.size_type = size_type
        grid.source_note = MOSMADE_SOURCE_NOTE
    _replace_rows(db, grid, rows)
    db.flush()
    db.refresh(grid)
    return grid


def seed_mosmade_men_first_row(db: Session) -> SizeGrid:
    """Backward-compatible helper: seeds full men grid (includes RU 46/S)."""
    return seed_mosmade_men_grid(db)


def seed_mosmade_men_grid(db: Session) -> SizeGrid:
    """Idempotent full Mosmade men grid (`6.2.2.5`)."""
    return _ensure_grid(
        db,
        name=MOSMADE_MEN_GRID_NAME,
        size_type=SizeGridSizeType.MEN,
        rows=MOSMADE_MEN_ROWS,
    )


def seed_mosmade_women_grid(db: Session) -> SizeGrid:
    """Idempotent full Mosmade women grid (`6.2.2.6`)."""
    return _ensure_grid(
        db,
        name=MOSMADE_WOMEN_GRID_NAME,
        size_type=SizeGridSizeType.WOMEN,
        rows=MOSMADE_WOMEN_ROWS,
    )


def seed_mosmade_reference_grids(db: Session) -> tuple[SizeGrid, SizeGrid]:
    """Seed men + women Mosmade reference grids."""
    return seed_mosmade_men_grid(db), seed_mosmade_women_grid(db)
