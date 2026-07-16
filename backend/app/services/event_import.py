from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.sport_event import SportEvent
from app.schemas.event_filter import EventFilterRequest
from app.schemas.normalized_event import NormalizedEvent
from app.services.event_filter import EventFilterService
from app.services.event_identity import EventIdentityService

@dataclass(slots=True)
class EventImportResult:
    received: int = 0
    filtered_out: int = 0
    created: int = 0
    duplicates: int = 0
    failed: int = 0


class EventImportService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def import_events(
        self,
        events: list[NormalizedEvent],
        filters: EventFilterRequest,
    ) -> EventImportResult:
        result = EventImportResult(
            received=len(events),
        )

        for item in events:
            if not EventFilterService.matches(
                    event=item,
                    period_start=filters.period_start,
                    period_end=filters.period_end,
                    sport=filters.sport,
                    city=filters.city,
            ):
                result.filtered_out += 1
                continue

            if not item.deduplication_key:
                item.deduplication_key = EventIdentityService.build_key(item)

            if self._find_duplicate(item) is not None:
                result.duplicates += 1
                continue

            event = SportEvent(
                **item.model_dump(),
            )

            self.db.add(event)

            try:
                self.db.commit()
                result.created += 1

            except IntegrityError:
                self.db.rollback()
                result.duplicates += 1

            except Exception:
                self.db.rollback()
                result.failed += 1

        return result

    def _find_duplicate(
            self,
            item: NormalizedEvent,
    ) -> SportEvent | None:
        if not item.deduplication_key:
            return None

        statement = select(SportEvent).where(
            SportEvent.deduplication_key == item.deduplication_key,
        )

        return self.db.scalar(statement)