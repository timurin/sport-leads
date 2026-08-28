"""Stage 28.1.3 / 28.1.6 — stored number vs live display `/{N}`."""

from app.services.tech_card_display import format_tech_card_display_number


def test_display_appends_planned_count() -> None:
    assert format_tech_card_display_number("1310-1", 5) == "1310-1/5"


def test_display_without_planned_is_stored_number() -> None:
    assert format_tech_card_display_number("1310-1", None) == "1310-1"
    assert format_tech_card_display_number("1310-1", 0) == "1310-1"


def test_display_strips_stored_number() -> None:
    assert format_tech_card_display_number("  1310-2  ", 3) == "1310-2/3"
