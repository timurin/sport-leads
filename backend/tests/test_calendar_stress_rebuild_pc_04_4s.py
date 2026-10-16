"""Authorization boundary for the destructive local stress-dataset command."""
from datetime import date
from types import SimpleNamespace

import pytest

from scripts.rebuild_calendar_stress_pc_04_4s import OLD_NUMBERS, card_specs, exact_old_set


def old_cards():
    return [SimpleNamespace(number=number, order_group_id=index, sales_order_id=None)
            for index, number in enumerate(sorted(OLD_NUMBERS), 1)]


def test_exact_authorized_cards_pass():
    exact_old_set(old_cards())


@pytest.mark.parametrize("change", ["missing", "extra", "duplicate", "foreign", "linked_order", "no_group"])
def test_cleanup_stops_before_deletion_for_wrong_scope(change):
    cards = old_cards()
    if change == "missing":
        cards.pop()
    elif change == "extra":
        cards.append(SimpleNamespace(number="VIS-STRESS-031", order_group_id=31, sales_order_id=None))
    elif change == "duplicate":
        cards[-1].number = cards[0].number
    elif change == "foreign":
        cards[-1].number = "REAL-ORDER-030"
    elif change == "linked_order":
        cards[-1].sales_order_id = 1
    else:
        cards[-1].order_group_id = None
    with pytest.raises(RuntimeError, match="STOP"):
        exact_old_set(cards)


def test_stress_cases_have_requested_distribution_and_distinct_dates_quantities():
    specs = card_specs(date(2026, 10, 10))
    assert len({row["number"] for row in specs}) == 30
    assert [sum(row["category"] == category for row in specs) for category in ("small", "medium", "large", "tight")] == [8, 10, 8, 4]
    assert len({row["quantity"] for row in specs}) == 30
    assert len({row["planning_start_date"] for row in specs}) >= 5
    assert len({row["shipping_date"] for row in specs}) >= 20
    assert all(row["shipping_date"] >= row["planning_start_date"] for row in specs)
