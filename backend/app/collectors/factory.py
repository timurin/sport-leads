from app.collectors.mock import MockCollector
from app.collectors.source_base import SourceCollector


class UnsupportedSourceTypeError(ValueError):
    """
    Указанный тип источника не поддерживается.
    """


class CollectorFactory:
    """
    Создаёт коллектор на основании Source.source_type.
    """

    _collectors: dict[str, type[SourceCollector]] = {
        "mock": MockCollector,
    }

    @classmethod
    def create(
        cls,
        source_type: str,
    ) -> SourceCollector:
        normalized_type = source_type.strip().casefold()

        collector_class = cls._collectors.get(
            normalized_type
        )

        if collector_class is None:
            supported_types = ", ".join(
                sorted(cls._collectors)
            )

            raise UnsupportedSourceTypeError(
                f"Неподдерживаемый тип источника: "
                f"{source_type}. "
                f"Поддерживаемые типы: "
                f"{supported_types or 'отсутствуют'}"
            )

        return collector_class()

    @classmethod
    def register(
        cls,
        source_type: str,
        collector_class: type[SourceCollector],
    ) -> None:
        normalized_type = source_type.strip().casefold()

        if not normalized_type:
            raise ValueError(
                "Тип источника не может быть пустым"
            )

        cls._collectors[normalized_type] = collector_class

    @classmethod
    def supported_types(cls) -> tuple[str, ...]:
        return tuple(
            sorted(cls._collectors)
        )