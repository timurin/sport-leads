from __future__ import annotations

from datetime import datetime, timezone

from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.collectors.factory import (
    CollectorFactory,
    UnsupportedSourceTypeError,
)
from app.models.import_run import ImportRun, ImportStatus
from app.models.source import Source
from app.schemas.event_filter import EventFilterRequest
from app.schemas.normalized_event import NormalizedEvent
from app.services.event_import import EventImportService


class SourceNotFoundError(ValueError):
    pass


class SourceInactiveError(ValueError):
    pass


class ImportRunNotFoundError(ValueError):
    pass


class ImportService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def run_source(
        self,
        source_id: int,
        trigger_type: str = "manual",
    ) -> ImportRun:
        source = self.db.get(Source, source_id)

        if source is None:
            raise SourceNotFoundError(
                f"Источник с id={source_id} не найден"
            )

        if not source.is_active:
            raise SourceInactiveError(
                f"Источник с id={source_id} отключён"
            )

        import_run = self._create_run(
            source=source,
            trigger_type=trigger_type,
        )

        try:
            collector = CollectorFactory.create(
                source.source_type
            )

            collector_result = collector.collect(source)

            import_run.items_found = (
                collector_result.items_found
            )

            normalized_events: list[NormalizedEvent] = []
            validation_errors: list[str] = []

            for index, item in enumerate(
                collector_result.items,
                start=1,
            ):
                try:
                    normalized_event = (
                        NormalizedEvent.model_validate(item)
                    )
                except ValidationError as error:
                    validation_errors.append(
                        f"Запись {index}: {error}"
                    )
                    continue

                normalized_events.append(
                    normalized_event
                )

            filters = EventFilterRequest(
                sport=source.sport,
                city=source.city,
            )

            import_result = (
                EventImportService(
                    self.db
                ).import_events(
                    events=normalized_events,
                    filters=filters,
                )
            )

            import_run.items_created = (
                import_result.created
            )

            import_run.items_updated = 0

            import_run.items_skipped = (
                import_result.filtered_out
                + import_result.duplicates
                + import_result.failed
                + len(validation_errors)
            )

            errors = [
                *collector_result.errors,
                *validation_errors,
            ]

            if errors:
                import_run.error_message = "\n".join(
                    errors
                )

            if (
                import_result.failed > 0
                or validation_errors
                or collector_result.errors
            ):
                import_run.status = ImportStatus.FAILED
            else:
                import_run.status = (
                    ImportStatus.COMPLETED
                )

        except UnsupportedSourceTypeError as error:
            import_run.status = ImportStatus.FAILED
            import_run.error_message = str(error)

        except Exception as error:
            import_run.status = ImportStatus.FAILED
            import_run.error_message = (
                f"{error.__class__.__name__}: {error}"
            )

        import_run.finished_at = datetime.now(
            timezone.utc
        )

        self.db.commit()
        self.db.refresh(import_run)

        return import_run

    def run_all_active(
        self,
        trigger_type: str = "manual_all",
    ) -> list[ImportRun]:
        statement = (
            select(Source)
            .where(Source.is_active.is_(True))
            .order_by(Source.id)
        )

        sources = list(
            self.db.scalars(statement).all()
        )

        results: list[ImportRun] = []

        for source in sources:
            result = self.run_source(
                source_id=source.id,
                trigger_type=trigger_type,
            )

            results.append(result)

        return results

    def get_run(
        self,
        import_run_id: int,
    ) -> ImportRun:
        import_run = self.db.get(
            ImportRun,
            import_run_id,
        )

        if import_run is None:
            raise ImportRunNotFoundError(
                f"Запуск импорта "
                f"с id={import_run_id} не найден"
            )

        return import_run

    def list_runs(
        self,
        source_id: int | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[ImportRun]:
        statement = (
            select(ImportRun)
            .order_by(ImportRun.id.desc())
            .offset(offset)
            .limit(limit)
        )

        if source_id is not None:
            statement = statement.where(
                ImportRun.source_id == source_id
            )

        return list(
            self.db.scalars(statement).all()
        )

    def _create_run(
        self,
        source: Source,
        trigger_type: str,
    ) -> ImportRun:
        import_run = ImportRun(
            source_id=source.id,
            status=ImportStatus.RUNNING,
            started_at=datetime.now(timezone.utc),
            trigger_type=trigger_type,
            items_found=0,
            items_created=0,
            items_updated=0,
            items_skipped=0,
        )

        self.db.add(import_run)
        self.db.commit()
        self.db.refresh(import_run)

        return import_run