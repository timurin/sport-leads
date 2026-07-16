import re
from dataclasses import dataclass
from datetime import datetime


@dataclass(slots=True)
class EkpEvent:
    title: str
    start_date: str
    end_date: str
    participants_count: int | None
    event_code: str | None
    country: str | None
    participant_category: str | None
    location: str | None
    discipline: str | None


class EkpPdfParser:
    DATE_PATTERN = re.compile(r"^\d{2}\.\d{2}\.\d{4}$")
    INTEGER_PATTERN = re.compile(r"^\d+$")

    PAGE_MARKER_PATTERN = re.compile(
        r"\s*Стр\.\s*\d+\s+из\s+\d+\s*",
        re.IGNORECASE,
    )

    def parse(self, text: str) -> list[EkpEvent]:
        blocks = self._split_blocks(text)
        events: list[EkpEvent] = []

        for block in blocks:
            event = self._parse_block(block)

            if event is not None:
                events.append(event)

        return events

    @staticmethod
    def _split_blocks(text: str) -> list[list[str]]:
        blocks: list[list[str]] = []
        current_block: list[str] = []

        for raw_line in text.splitlines():
            line = " ".join(raw_line.strip().split())

            if not line:
                continue

            if line == ".":
                if current_block:
                    blocks.append(current_block)
                    current_block = []
                continue

            current_block.append(line)

        if current_block:
            blocks.append(current_block)

        return blocks

    def _parse_block(self, lines: list[str]) -> EkpEvent | None:
        if len(lines) < 3:
            return None

        date_indexes = [
            index
            for index, value in enumerate(lines)
            if self.DATE_PATTERN.fullmatch(value)
        ]

        if len(date_indexes) < 2:
            return None

        first_date_index = date_indexes[0]
        second_date_index = date_indexes[1]

        if first_date_index == 0:
            return None

        title = " ".join(lines[:first_date_index]).strip()
        title = self.PAGE_MARKER_PATTERN.sub("", title).strip()

        start_date = lines[first_date_index]
        end_date = lines[second_date_index]

        tail = lines[second_date_index + 1 :]

        participants_count = None
        event_code = None
        country = None
        participant_category = None
        location = None
        discipline = None

        if tail and self.INTEGER_PATTERN.fullmatch(tail[0]):
            participants_count = int(tail.pop(0))

        if tail and self.INTEGER_PATTERN.fullmatch(tail[0]):
            event_code = tail.pop(0)

        if tail:
            country = tail.pop(0)

        if tail:
            participant_category = tail.pop(0)

        if tail:
            location = tail.pop(0)

        if tail:
            discipline = " ".join(tail)

        participant_category = self._clean_text(participant_category)
        location = self._clean_text(location)
        discipline = self._clean_text(discipline)

        return EkpEvent(
            title=title,
            start_date=start_date,
            end_date=end_date,
            participants_count=participants_count,
            event_code=event_code,
            country=country,
            participant_category=participant_category,
            location=location,
            discipline=discipline,
        )

    @staticmethod
    def _clean_text(value: str | None) -> str | None:
        if value is None:
            return None

        cleaned = " ".join(value.split())
        cleaned = cleaned.strip(" .,*")

        return cleaned or None

    @staticmethod
    def parse_date(value: str):
        return datetime.strptime(value, "%d.%m.%Y").date()