from app.collectors.result import CollectorResult
from app.collectors.source_base import SourceCollector
from app.models.source import Source


class MockCollector(SourceCollector):
    """
    Тестовый коллектор для проверки автоматического импорта.
    """

    def collect(self, source: Source) -> CollectorResult:
        football_sport = (
            source.sport
            if source.sport != "Все"
            else "Футбол"
        )

        volleyball_sport = (
            source.sport
            if source.sport != "Все"
            else "Волейбол"
        )

        first_city = (
            source.city
            if source.city != "Все"
            else "Москва"
        )

        second_city = (
            source.city
            if source.city != "Все"
            else "Санкт-Петербург"
        )

        return CollectorResult(
            items=[
                {
                    "external_id": f"{source.id}-event-1",
                    "title": "Тестовый футбольный турнир",
                    "sport": football_sport,
                    "city": first_city,
                    "country": "Россия",
                    "source_name": source.name,
                    "source_url": source.url,
                    "description": (
                        "Тестовое мероприятие, созданное "
                        "MockCollector."
                    ),
                },
                {
                    "external_id": f"{source.id}-event-2",
                    "title": "Тестовый волейбольный турнир",
                    "sport": volleyball_sport,
                    "city": second_city,
                    "country": "Россия",
                    "source_name": source.name,
                    "source_url": source.url,
                    "description": (
                        "Второе тестовое мероприятие, созданное "
                        "MockCollector."
                    ),
                },
            ]
        )