import requests
import certifi
from requests import Response
from requests.exceptions import RequestException

from app.collectors.base import BaseCollector, CollectedPage


class HttpCollector(BaseCollector):
    def __init__(
        self,
        timeout: int = 30,
        user_agent: str | None = None,
    ) -> None:
        self.timeout = timeout
        self.user_agent = user_agent or (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/150.0 Safari/537.36"
        )

    def collect(self, url: str) -> CollectedPage:
        try:
            response = requests.get(
                url,
                timeout=self.timeout,
                headers={
                    "User-Agent": self.user_agent,
                    "Accept-Language": "ru-RU,ru;q=0.9,en;q=0.8",
                },
                verify=certifi.where(),
            )

            self._validate_response(response)

            return CollectedPage(
                url=response.url,
                status_code=response.status_code,
                content=response.text,
            )

        except RequestException as error:
            raise RuntimeError(
                f"Не удалось получить страницу {url}: {error}"
            ) from error

    @staticmethod
    def _validate_response(response: Response) -> None:
        response.raise_for_status()

        content_type = response.headers.get("Content-Type", "")

        if "text/html" not in content_type.lower():
            raise RuntimeError(
                "Страница не является HTML-документом: "
                f"{content_type or 'Content-Type отсутствует'}"
            )