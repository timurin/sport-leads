from datetime import date
from typing import Protocol


class EventForFiltering(Protocol):
    start_date: date | None
    end_date: date | None
    sport: str | None
    city: str | None


class EventFilterService:
    ALL_VALUE = "Все"

    @classmethod
    def matches(
        cls,
        event: EventForFiltering,
        period_start: date | None = None,
        period_end: date | None = None,
        sport: str = ALL_VALUE,
        city: str = ALL_VALUE,
    ) -> bool:
        if not cls._matches_period(
            event=event,
            period_start=period_start,
            period_end=period_end,
        ):
            return False

        if not cls._matches_text_filter(
            value=event.sport,
            selected=sport,
        ):
            return False

        if not cls._matches_text_filter(
            value=event.city,
            selected=city,
        ):
            return False

        return True

    @staticmethod
    def _matches_period(
        event: EventForFiltering,
        period_start: date | None,
        period_end: date | None,
    ) -> bool:
        event_start = event.start_date
        event_end = event.end_date or event.start_date

        if event_start is None and event_end is None:
            return period_start is None and period_end is None

        if event_start is None:
            event_start = event_end

        if event_end is None:
            event_end = event_start

        if period_start is not None and event_end < period_start:
            return False

        if period_end is not None and event_start > period_end:
            return False

        return True

    @classmethod
    def _matches_text_filter(
        cls,
        value: str | None,
        selected: str,
    ) -> bool:
        selected_normalized = selected.strip().casefold()

        if selected_normalized == cls.ALL_VALUE.casefold():
            return True

        if value is None:
            return False

        return selected_normalized in value.strip().casefold()