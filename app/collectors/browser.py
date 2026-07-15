from playwright.sync_api import Error as PlaywrightError
from playwright.sync_api import TimeoutError as PlaywrightTimeoutError
from playwright.sync_api import sync_playwright

from app.collectors.base import BaseCollector, CollectedPage


class BrowserCollector(BaseCollector):
    def __init__(
        self,
        timeout: int = 45_000,
        ignore_https_errors: bool = False,
    ) -> None:
        self.timeout = timeout
        self.ignore_https_errors = ignore_https_errors

    def collect(self, url: str) -> CollectedPage:
        try:
            with sync_playwright() as playwright:
                browser = playwright.chromium.launch(headless=True)

                context = browser.new_context(
                    locale="ru-RU",
                    ignore_https_errors=self.ignore_https_errors,
                )

                page = context.new_page()

                response = page.goto(
                    url,
                    wait_until="domcontentloaded",
                    timeout=self.timeout,
                )

                page.wait_for_timeout(1500)

                html = page.content()
                final_url = page.url
                status_code = response.status if response else 200

                context.close()
                browser.close()

                return CollectedPage(
                    url=final_url,
                    status_code=status_code,
                    content=html,
                )

        except (PlaywrightTimeoutError, PlaywrightError) as error:
            raise RuntimeError(
                f"Не удалось открыть страницу через браузер {url}: {error}"
            ) from error