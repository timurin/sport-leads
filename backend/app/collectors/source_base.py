from abc import ABC, abstractmethod

from app.collectors.result import CollectorResult
from app.models.source import Source


class SourceCollector(ABC):
    """
    Базовый класс коллектора источников.
    """

    @abstractmethod
    def collect(self, source: Source) -> CollectorResult:
        """
        Возвращает результат обработки источника.
        """
        raise NotImplementedError