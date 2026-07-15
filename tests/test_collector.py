from app.collectors.http import HttpCollector
from app.parsers.event_page import EventPageParser


def main() -> None:
    url = "https://example.com"

    collector = HttpCollector()
    parser = EventPageParser()

    page = collector.collect(url)
    parsed = parser.parse(page.content)

    print(f"URL: {page.url}")
    print(f"HTTP status: {page.status_code}")
    print(f"Title: {parsed.title}")
    print(f"Text preview: {parsed.text[:300]}")


if __name__ == "__main__":
    main()