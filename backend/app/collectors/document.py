from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urlparse

import requests
from playwright.sync_api import Error as PlaywrightError
from playwright.sync_api import sync_playwright


@dataclass(slots=True)
class DownloadedDocument:
    url: str
    path: Path
    content_type: str | None
    size_bytes: int


class DocumentCollector:
    def __init__(
        self,
        download_dir: str | Path = "storage/documents",
        timeout: int = 60,
        use_browser: bool = False,
        ignore_https_errors: bool = False,
    ) -> None:
        self.download_dir = Path(download_dir)
        self.timeout = timeout
        self.use_browser = use_browser
        self.ignore_https_errors = ignore_https_errors

        self.download_dir.mkdir(
            parents=True,
            exist_ok=True,
        )

    def download(self, url: str) -> DownloadedDocument:
        if self.use_browser:
            return self._download_with_browser(url)

        return self._download_with_requests(url)

    def _download_with_requests(
        self,
        url: str,
    ) -> DownloadedDocument:
        try:
            response = requests.get(
                url,
                timeout=self.timeout,
                stream=True,
                headers={
                    "User-Agent": (
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
                    ),
                },
            )
            response.raise_for_status()

        except requests.RequestException as error:
            raise RuntimeError(
                f"Не удалось скачать документ {url}: {error}"
            ) from error

        filename = self._get_filename(
            url=response.url,
            content_disposition=response.headers.get(
                "Content-Disposition"
            ),
        )

        target_path = self.download_dir / filename

        with target_path.open("wb") as file:
            for chunk in response.iter_content(
                chunk_size=1024 * 1024,
            ):
                if chunk:
                    file.write(chunk)

        return DownloadedDocument(
            url=response.url,
            path=target_path,
            content_type=response.headers.get("Content-Type"),
            size_bytes=target_path.stat().st_size,
        )

    def _download_with_browser(
        self,
        url: str,
    ) -> DownloadedDocument:
        try:
            with sync_playwright() as playwright:
                browser = playwright.chromium.launch(headless=True)

                context = browser.new_context(
                    ignore_https_errors=self.ignore_https_errors,
                    accept_downloads=True,
                )

                page = context.new_page()

                response = context.request.get(
                    url,
                    timeout=self.timeout * 1000,
                )

                if not response.ok:
                    raise RuntimeError(
                        f"HTTP {response.status} при загрузке {url}"
                    )

                content = response.body()

                content_disposition = response.headers.get(
                    "content-disposition"
                )

                filename = self._get_filename(
                    url=url,
                    content_disposition=content_disposition,
                )

                target_path = self.download_dir / filename
                target_path.write_bytes(content)

                content_type = response.headers.get("content-type")

                context.close()
                browser.close()

                return DownloadedDocument(
                    url=url,
                    path=target_path,
                    content_type=content_type,
                    size_bytes=target_path.stat().st_size,
                )

        except (PlaywrightError, RuntimeError) as error:
            raise RuntimeError(
                f"Не удалось скачать документ через браузер {url}: {error}"
            ) from error

    @staticmethod
    def _get_filename(
        url: str,
        content_disposition: str | None,
    ) -> str:
        if content_disposition and "filename=" in content_disposition:
            filename = content_disposition.split(
                "filename=",
                maxsplit=1,
            )[1].strip().strip('"')

            if filename:
                return filename

        path = urlparse(url).path
        filename = Path(path).name

        return filename or "downloaded_document"