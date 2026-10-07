"""Planning dates and locks for a technical card. Does not place work."""

from __future__ import annotations

from datetime import date, datetime, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from sqlalchemy.orm import Session

from app.models.platform_system_settings import PlatformSystemSettings
from app.models.technical_card import TechnicalCard
from app.schemas.technical_card import TechnicalCardPlanningUpdate

PLATFORM_TIMEZONE = "Europe/Moscow"


def platform_timezone_name(db: Session) -> str:
    row = db.get(PlatformSystemSettings, 1)
    name = (row.default_timezone if row is not None else "") or ""
    name = name.strip()
    return name or PLATFORM_TIMEZONE


def planning_start_on(moment: datetime, timezone_name: str) -> date:
    if moment.tzinfo is None:
        moment = moment.replace(tzinfo=timezone.utc)
    try:
        zone = ZoneInfo(timezone_name)
    except ZoneInfoNotFoundError as error:
        raise ValueError(f"Unknown platform timezone: {timezone_name}") from error
    return moment.astimezone(zone).date()


def new_card_planning_start(db: Session, moment: datetime | None = None) -> date:
    when = moment if moment is not None else datetime.now(timezone.utc)
    return planning_start_on(when, platform_timezone_name(db))


def update_technical_card_planning(
    db: Session, card_id: int, payload: TechnicalCardPlanningUpdate
) -> TechnicalCard:
    from app.services.technical_cards import (
        TechnicalCardNotFoundError,
        TechnicalCardValidationError,
    )

    card = db.get(TechnicalCard, card_id)
    if card is None:
        raise TechnicalCardNotFoundError("Technical card not found")
    fields = payload.model_fields_set
    if not fields:
        raise TechnicalCardValidationError("Укажите хотя бы одно поле планирования")
    if "planning_start_date" in fields:
        card.planning_start_date = payload.planning_start_date
    if "shipping_date" in fields:
        card.shipping_date = payload.shipping_date
    if "priority" in fields:
        card.priority = payload.priority
    if "plan_locked" in fields:
        if payload.plan_locked is None:
            raise TechnicalCardValidationError("plan_locked нельзя очистить")
        card.plan_locked = payload.plan_locked
    db.flush()
    return card
