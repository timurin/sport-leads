"""Live display number for technical cards (Stage 28 / SL-STANDALONE-TC-v1).

Stored `TechnicalCard.number` stays `{orderNo}-{seq}`. UI/print/list append `/{N}`
from the live planned count on SalesOrder or standalone order group.
"""

from __future__ import annotations


def format_tech_card_display_number(
    stored_number: str, planned_count: int | None
) -> str:
    number = stored_number.strip()
    if planned_count is not None and planned_count >= 1:
        return f"{number}/{planned_count}"
    return number
