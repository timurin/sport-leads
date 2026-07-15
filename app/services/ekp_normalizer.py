import re

from app.parsers.ekp_pdf import EkpEvent, EkpPdfParser
from app.schemas.normalized_event import NormalizedEvent


class EkpEventNormalizer:
    CITY_PATTERN = re.compile(
        r"(?:г\.\s*)?([А-ЯЁ][А-Яа-яЁё\- ]+)$"
    )

    def normalize(
        self,
        event: EkpEvent,
        sport: str,
        source_document_url: str,
    ) -> NormalizedEvent:
        region, city = self._parse_location(event.location)

        description_parts = [
            event.discipline,
            (
                f"Категория участников: "
                f"{event.participant_category}"
                if event.participant_category
                else None
            ),
            (
                f"Количество участников: "
                f"{event.participants_count}"
                if event.participants_count is not None
                else None
            ),
        ]

        description = "\n".join(
            part
            for part in description_parts
            if part
        )

        return NormalizedEvent(
            title=event.title,
            sport=sport,
            city=city,
            region=region,
            country=event.country or "Россия",
            start_date=EkpPdfParser.parse_date(event.start_date),
            end_date=EkpPdfParser.parse_date(event.end_date),
            organizer="Министерство спорта России",
            source_name="Минспорт ЕКП",
            source_url=source_document_url,
            source_document_url=source_document_url,
            external_id=event.event_code,
            description=description or None,
        )

    def _parse_location(
        self,
        location: str | None,
    ) -> tuple[str | None, str | None]:
        if not location:
            return None, None

        normalized = " ".join(location.split())
        city_match = self.CITY_PATTERN.search(normalized)

        if city_match is None:
            return normalized, None

        city = city_match.group(1).strip()

        region = normalized[:city_match.start()].strip(" ,")
        region = re.sub(r"\bг\.\s*$", "", region).strip(" ,")

        return region or None, city or None