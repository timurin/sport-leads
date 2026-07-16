from dataclasses import dataclass
from urllib.parse import urljoin

from bs4 import BeautifulSoup


@dataclass(slots=True)
class ParsedLink:
    text: str
    url: str


class LinksParser:
    DOCUMENT_EXTENSIONS = (
        ".pdf",
        ".xlsx",
        ".xls",
        ".docx",
        ".doc",
        ".csv",
    )

    def parse(
        self,
        html: str,
        base_url: str,
    ) -> list[ParsedLink]:
        soup = BeautifulSoup(html, "lxml")
        links: list[ParsedLink] = []
        seen_urls: set[str] = set()

        for anchor in soup.find_all("a", href=True):
            href = anchor.get("href", "").strip()

            if not href:
                continue

            absolute_url = urljoin(base_url, href)
            lower_url = absolute_url.lower()

            text = " ".join(
                anchor.get_text(separator=" ", strip=True).split()
            )

            is_document = any(
                extension in lower_url
                for extension in self.DOCUMENT_EXTENSIONS
            )

            looks_like_calendar = any(
                keyword in text.casefold()
                for keyword in (
                    "календар",
                    "екп",
                    "план мероприятий",
                    "спортивных мероприятий",
                )
            )

            if not is_document and not looks_like_calendar:
                continue

            if absolute_url in seen_urls:
                continue

            seen_urls.add(absolute_url)

            links.append(
                ParsedLink(
                    text=text or "Без названия",
                    url=absolute_url,
                )
            )

        return links