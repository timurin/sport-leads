"""Product-model presence in the global operations journal (Stage 18.4).

Until the journal ships, this module is a stable hook for catalog guards:
size-contour edits and revert-to-draft are allowed only when the model has
no recorded sales/production operations.
"""

from __future__ import annotations

from sqlalchemy.orm import Session

# Shown in UI modal when a blocked contour change is attempted.
MODEL_OPERATIONS_WARNING = (
    "По данной модели были операции! Изменения могут затронуть отчетность!"
)


def product_model_has_journal_operations(db: Session, model_id: int) -> bool:
    """Return True when the global ops journal has sales/production rows for the model.

    Stage 18.4 will query the journal. Until then there is no store — always False
    (no write = no lock). Do not invent sales/order proxies here.
    """
    _ = (db, model_id)
    return False
