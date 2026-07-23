"""Standard COLOR options for system characteristic `color`."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.characteristics import (
    CharacteristicDefinition,
    CharacteristicOption,
    nomenclature_characteristic_value_options,
    variant_options,
)
from app.services.characteristic_operations_journal import (
    characteristic_option_has_journal_operations,
)

# (code, label, hex) — 50 reference clothing/catalog colors.
STANDARD_COLOR_OPTIONS: tuple[tuple[str, str, str], ...] = (
    ("white", "Белый", "#FFFFFF"),
    ("black", "Чёрный", "#000000"),
    ("gray", "Серый", "#808080"),
    ("light_gray", "Светло-серый", "#D3D3D3"),
    ("dark_gray", "Тёмно-серый", "#4A4A4A"),
    ("anthracite", "Антрацит", "#2F2F2F"),
    ("graphite", "Графитовый", "#383838"),
    ("silver", "Серебристый", "#C0C0C0"),
    ("red", "Красный", "#FF0000"),
    ("dark_red", "Тёмно-красный", "#8B0000"),
    ("burgundy", "Бордовый", "#800020"),
    ("cherry", "Вишнёвый", "#990F4B"),
    ("crimson", "Малиновый", "#DC143C"),
    ("brick", "Кирпичный", "#CB4154"),
    ("pink", "Розовый", "#FFC0CB"),
    ("fuchsia", "Фуксия", "#FF00FF"),
    ("purple", "Пурпурный", "#9B2D5B"),
    ("orange", "Оранжевый", "#FFA500"),
    ("coral", "Коралловый", "#FF7F50"),
    ("terracotta", "Терракотовый", "#E2725B"),
    ("yellow", "Жёлтый", "#FFFF00"),
    ("gold", "Золотой", "#FFD700"),
    ("mustard", "Горчичный", "#FFDB58"),
    ("beige", "Бежевый", "#F5F5DC"),
    ("cream", "Кремовый", "#FFFDD0"),
    ("milk", "Молочный", "#FFF8E7"),
    ("sand", "Песочный", "#C2B280"),
    ("brown", "Коричневый", "#8B4513"),
    ("chocolate", "Шоколадный", "#D2691E"),
    ("copper", "Медный", "#B87333"),
    ("khaki", "Хаки", "#C3B091"),
    ("olive", "Оливковый", "#808000"),
    ("green", "Зелёный", "#008000"),
    ("dark_green", "Тёмно-зелёный", "#006400"),
    ("emerald", "Изумрудный", "#50C878"),
    ("lime", "Лаймовый", "#32CD32"),
    ("salad", "Салатовый", "#7CFC00"),
    ("mint", "Мятный", "#98FF98"),
    ("sea_green", "Морской волны", "#2E8B57"),
    ("turquoise", "Бирюзовый", "#40E0D0"),
    ("cyan", "Циан", "#00FFFF"),
    ("sky_blue", "Небесно-голубой", "#87CEFA"),
    ("light_blue", "Голубой", "#87CEEB"),
    ("blue", "Синий", "#0000FF"),
    ("dark_blue", "Тёмно-синий", "#00008B"),
    ("cornflower", "Васильковый", "#6495ED"),
    ("indigo", "Индиго", "#4B0082"),
    ("violet", "Фиолетовый", "#800080"),
    ("lilac", "Сиреневый", "#C8A2C8"),
    ("lavender", "Лавандовый", "#E6E6FA"),
)

assert len(STANDARD_COLOR_OPTIONS) == 50


def _norm_label(value: str) -> str:
    return value.casefold().replace("ё", "е").strip()


def _norm_hex(value: str | None) -> str | None:
    if not value:
        return None
    text = value.strip().upper()
    if not text.startswith("#"):
        text = f"#{text}"
    return text


def _option_in_use(db: Session, option_id: int) -> bool:
    if characteristic_option_has_journal_operations(db, option_id):
        return True
    if db.scalar(
        select(variant_options.c.variant_id)
        .where(variant_options.c.option_id == option_id)
        .limit(1)
    ):
        return True
    if db.scalar(
        select(nomenclature_characteristic_value_options.c.value_id)
        .where(nomenclature_characteristic_value_options.c.option_id == option_id)
        .limit(1)
    ):
        return True
    return False


def seed_standard_color_options(db: Session) -> None:
    """Upsert 50 standard colors on system `color` and drop unused duplicates."""
    color = db.scalar(
        select(CharacteristicDefinition).where(CharacteristicDefinition.code == "color")
    )
    if color is None or color.kind != "COLOR":
        return

    existing = list(
        db.scalars(
            select(CharacteristicOption).where(
                CharacteristicOption.characteristic_id == color.id
            )
        ).all()
    )
    by_hex: dict[str, CharacteristicOption] = {}
    by_label: dict[str, CharacteristicOption] = {}
    by_code: dict[str, CharacteristicOption] = {}
    for row in existing:
        hex_key = _norm_hex(row.hex_value)
        if hex_key:
            by_hex.setdefault(hex_key, row)
        by_label.setdefault(_norm_label(row.label), row)
        by_code[row.code] = row

    kept_ids: set[int] = set()

    for sort_order, (code, label, hex_value) in enumerate(STANDARD_COLOR_OPTIONS):
        hex_key = _norm_hex(hex_value)
        assert hex_key is not None
        match = (
            by_hex.get(hex_key)
            or by_label.get(_norm_label(label))
            or by_code.get(code)
        )
        if match is not None:
            match.label = label
            match.hex_value = hex_key
            match.sort_order = sort_order
            match.is_active = True
            if match.code != code and code not in by_code:
                match.code = code
                by_code[code] = match
            kept_ids.add(match.id)
            by_hex[hex_key] = match
            by_label[_norm_label(label)] = match
            continue

        created = CharacteristicOption(
            characteristic_id=color.id,
            code=code,
            label=label,
            hex_value=hex_key,
            sort_order=sort_order,
            is_active=True,
        )
        db.add(created)
        db.flush()
        kept_ids.add(created.id)
        by_hex[hex_key] = created
        by_label[_norm_label(label)] = created
        by_code[code] = created

    standard_hexes = {
        _norm_hex(hex_value) for _, _, hex_value in STANDARD_COLOR_OPTIONS if hex_value
    }
    standard_labels = {_norm_label(label) for _, label, _ in STANDARD_COLOR_OPTIONS}

    refreshed = list(
        db.scalars(
            select(CharacteristicOption).where(
                CharacteristicOption.characteristic_id == color.id
            )
        ).all()
    )
    for row in refreshed:
        if row.id in kept_ids:
            continue
        hex_key = _norm_hex(row.hex_value)
        label_key = _norm_label(row.label)
        is_standard_duplicate = (hex_key in standard_hexes) or (
            label_key in standard_labels
        )
        if not is_standard_duplicate:
            continue
        if _option_in_use(db, row.id):
            row.is_active = False
        else:
            db.delete(row)

    db.flush()
