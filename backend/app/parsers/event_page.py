from dataclasses import dataclass

from bs4 import BeautifulSoup


@dataclass(slots=True)
class ParsedEventPage:
    title: str | None
    text: str


class EventPageParser:
    def parse(self, html: str) -> ParsedEventPage:
        soup = BeautifulSoup(html, "lxml")

        title = None

        if soup.title and soup.title.string:
            title = soup.title.string.strip()

        for tag in soup(["script", "style", "noscript"]):
            tag.decompose()

        text = " ".join(
            soup.get_text(separator=" ", strip=True).split()
        )

        return ParsedEventPage(
            title=title,
            text=text,
        )