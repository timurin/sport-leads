import re
from dataclasses import dataclass

import phonenumbers


@dataclass(slots=True)
class ExtractedEventDetails:
    emails: list[str]
    phones: list[str]
    dates: list[str]
    cities: list[str]


class EventDetailsExtractor:
    EMAIL_PATTERN = re.compile(
        r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b"
    )

    DATE_PATTERNS = (
        re.compile(r"\b\d{2}\.\d{2}\.\d{4}\b"),
        re.compile(r"\b\d{4}-\d{2}-\d{2}\b"),
    )

    KNOWN_CITIES = (
        "Москва",
        "Санкт-Петербург",
        "Казань",
        "Екатеринбург",
        "Новосибирск",
        "Самара",
        "Уфа",
        "Омск",
        "Пермь",
        "Краснодар",
        "Ростов-на-Дону",
        "Воронеж",
        "Нижний Новгород",
        "Челябинск",
        "Волгоград",
        "Сочи",
    )

    def extract(self, text: str) -> ExtractedEventDetails:
        return ExtractedEventDetails(
            emails=self._extract_emails(text),
            phones=self._extract_phones(text),
            dates=self._extract_dates(text),
            cities=self._extract_cities(text),
        )

    def _extract_emails(self, text: str) -> list[str]:
        return sorted(set(self.EMAIL_PATTERN.findall(text)))

    def _extract_phones(self, text: str) -> list[str]:
        phones: set[str] = set()

        for match in phonenumbers.PhoneNumberMatcher(text, "RU"):
            number = phonenumbers.format_number(
                match.number,
                phonenumbers.PhoneNumberFormat.E164,
            )
            phones.add(number)

        return sorted(phones)

    def _extract_dates(self, text: str) -> list[str]:
        dates: set[str] = set()

        for pattern in self.DATE_PATTERNS:
            dates.update(pattern.findall(text))

        return sorted(dates)

    def _extract_cities(self, text: str) -> list[str]:
        found = {
            city
            for city in self.KNOWN_CITIES
            if city.lower() in text.lower()
        }

        return sorted(found)