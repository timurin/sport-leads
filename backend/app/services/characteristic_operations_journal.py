"""Characteristic / option presence in the global operations journal (Stage 18.4).

Until the journal ships, interim delete guards use concrete FK usage checks in
`characteristics` services. This module remains the stable hook for journal rows.
"""

from __future__ import annotations

from sqlalchemy.orm import Session


CHARACTERISTIC_OPERATIONS_WARNING = (
    "По данной характеристике были операции! Удаление запрещено."
)


def characteristic_has_journal_operations(db: Session, characteristic_id: int) -> bool:
    """True when global ops journal has rows for this characteristic definition.

    Stage 18.4 will query the journal. Until then always False.
    """
    _ = (db, characteristic_id)
    return False


def characteristic_option_has_journal_operations(db: Session, option_id: int) -> bool:
    """True when global ops journal has rows for this characteristic option."""
    _ = (db, option_id)
    return False
