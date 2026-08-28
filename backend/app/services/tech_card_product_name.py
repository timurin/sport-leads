"""Tech-card product name snapshot (`nomenclature_name`, Stage 26.3.11)."""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.technical_card import TechnicalCard, TechnicalCardStatus
from app.services.technical_cards import (
    TechnicalCardNotFoundError,
    TechnicalCardValidationError,
)

NOMENCLATURE_NAME_MAX = 255


def update_technical_card_nomenclature_name(
    db: Session,
    card_id: int,
    *,
    nomenclature_name: str | None,
) -> TechnicalCard:
    card = db.get(TechnicalCard, card_id)
    if card is None:
        raise TechnicalCardNotFoundError("Technical card not found")
    if card.status == TechnicalCardStatus.CANCELLED:
        raise TechnicalCardValidationError(
            "Нельзя менять наименование изделия на отменённой техкарте"
        )
    if nomenclature_name is not None:
        nomenclature_name = nomenclature_name.strip() or None
        if (
            nomenclature_name is not None
            and len(nomenclature_name) > NOMENCLATURE_NAME_MAX
        ):
            raise TechnicalCardValidationError(
                "Наименование изделия не длиннее 255 символов"
            )
    card.nomenclature_name = nomenclature_name
    db.flush()
    return card
