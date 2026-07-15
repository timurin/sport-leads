from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass(slots=True)
class CollectedPage:
    """
    Результат загрузки одной HTML-страницы.
    """

    url: str
    status_code: int
    content: str


class BaseCollector(ABC):
    """
    Базовый класс для загрузчиков HTML-страниц.

    Реализации:
    - HttpCollector;
    - BrowserCollector.
    """

    @abstractmethod
    def collect(self, url: str) -> CollectedPage:
        """
        Загружает HTML-страницу по URL.
        """
        raise NotImplementedError
