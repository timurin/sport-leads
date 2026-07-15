from collections import deque
from dataclasses import dataclass
from urllib.parse import urlparse

from app.collectors.browser import BrowserCollector
from app.collectors.http import HttpCollector
from app.parsers.links import LinksParser, ParsedLink


@dataclass(slots=True)
class CrawledPage:
    url: str
    status_code: int
    depth: int
    links: list[ParsedLink]


@dataclass(slots=True)
class CrawlResult:
    start_url: str
    pages: list[CrawledPage]
    documents: list[ParsedLink]


class SiteCrawler:
    DOCUMENT_EXTENSIONS = (
        ".pdf",
        ".xlsx",
        ".xls",
        ".docx",
        ".doc",
        ".csv",
    )

    def __init__(
        self,
        max_depth: int = 2,
        max_pages: int = 20,
        use_browser: bool = True,
        ignore_https_errors: bool = False,
    ) -> None:
        self.max_depth = max_depth
        self.max_pages = max_pages
        self.links_parser = LinksParser()

        if use_browser:
            self.collector = BrowserCollector(
                ignore_https_errors=ignore_https_errors,
            )
        else:
            self.collector = HttpCollector()

    def crawl(self, start_url: str) -> CrawlResult:
        queue: deque[tuple[str, int]] = deque([(start_url, 0)])
        visited: set[str] = set()

        pages: list[CrawledPage] = []
        documents: list[ParsedLink] = []
        document_urls: set[str] = set()

        start_host = urlparse(start_url).netloc.lower()

        while queue and len(pages) < self.max_pages:
            current_url, depth = queue.popleft()

            if current_url in visited:
                continue

            visited.add(current_url)

            try:
                page = self.collector.collect(current_url)
            except RuntimeError:
                continue

            links = self.links_parser.parse(
                html=page.content,
                base_url=page.url,
            )

            pages.append(
                CrawledPage(
                    url=page.url,
                    status_code=page.status_code,
                    depth=depth,
                    links=links,
                )
            )

            for link in links:
                parsed_url = urlparse(link.url)
                lower_path = parsed_url.path.lower()

                is_document = lower_path.endswith(
                    self.DOCUMENT_EXTENSIONS
                )

                if is_document:
                    if link.url not in document_urls:
                        document_urls.add(link.url)
                        documents.append(link)

                    continue

                if depth >= self.max_depth:
                    continue

                if parsed_url.netloc.lower() != start_host:
                    continue

                if link.url not in visited:
                    queue.append((link.url, depth + 1))

        return CrawlResult(
            start_url=start_url,
            pages=pages,
            documents=documents,
        )