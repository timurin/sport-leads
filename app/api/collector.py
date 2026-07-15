
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.collectors.http import HttpCollector
from app.database.session import get_db
from app.extractors.event_details import EventDetailsExtractor
from app.extractors.sport_classifier import SportClassifier
from app.models.sport_event import SportEvent
from app.parsers.event_page import EventPageParser
from app.schemas.collector import CollectUrlRequest, CollectUrlResponse
from app.schemas.sport_event import SportEventRead

from app.collectors.browser import BrowserCollector

from app.parsers.links import LinksParser
from app.schemas.collector import (
    CollectLinksResponse,
    CollectedLink,
    CollectUrlRequest,
    CollectUrlResponse,
)

from app.collectors.crawler import SiteCrawler

from app.schemas.collector import (
    CollectLinksResponse,
    CollectedLink,
    CollectUrlRequest,
    CollectUrlResponse,
    CrawlRequest,
    CrawlResponse,
    CrawledPageResponse,
)

router = APIRouter(
    prefix="/collector",
    tags=["Collector"],
)


def parse_first_date(values: list[str]):
    if not values:
        return None

    value = values[0]

    for date_format in ("%d.%m.%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(value, date_format).date()
        except ValueError:
            continue

    return None


@router.post(
    "/preview",
    response_model=CollectUrlResponse,
)
def collect_preview(
    payload: CollectUrlRequest,
) -> CollectUrlResponse:
    if payload.use_browser:
        collector = BrowserCollector(
            ignore_https_errors=payload.ignore_https_errors,
        )
    else:
        collector = HttpCollector()
    parser = EventPageParser()
    extractor = EventDetailsExtractor()
    classifier = SportClassifier()

    try:
        page = collector.collect(str(payload.url))
        parsed = parser.parse(page.content)
        details = extractor.extract(parsed.text)

    except RuntimeError as error:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(error),
        ) from error

    return CollectUrlResponse(
        url=page.url,
        status_code=page.status_code,
        title=parsed.title,
        text_preview=parsed.text[:1000],
        emails=details.emails,
        phones=details.phones,
        dates=details.dates,
        cities=details.cities,
    )


@router.post(
    "/create-event",
    response_model=SportEventRead,
    status_code=status.HTTP_201_CREATED,
    responses={
        409: {
            "description": "Источник уже существует",
        },
        502: {
            "description": "Ошибка загрузки страницы",
        },
    },
)
def create_event_from_url(
    payload: CollectUrlRequest,
    db: Session = Depends(get_db),
) -> SportEvent:
    if payload.use_browser:
        collector = BrowserCollector(
            ignore_https_errors=payload.ignore_https_errors,
        )
    else:
        collector = HttpCollector()
    parser = EventPageParser()
    extractor = EventDetailsExtractor()
    classifier = SportClassifier()

    try:
        page = collector.collect(str(payload.url))
        parsed = parser.parse(page.content)
        details = extractor.extract(parsed.text)
        sport = classifier.classify(parsed.text) or "Не определён"

    except RuntimeError as error:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(error),
        ) from error

    existing_event = db.scalar(
        select(SportEvent).where(
            SportEvent.source_url == page.url,
        )
    )

    if existing_event is not None:
        if not payload.update_existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "Мероприятие из этого источника уже существует. "
                    f"ID записи: {existing_event.id}"
                ),
            )

        existing_event.title = parsed.title or existing_event.title
        existing_event.city = (
            details.cities[0]
            if details.cities
            else existing_event.city
        )
        existing_event.start_date = (
                parse_first_date(details.dates)
                or existing_event.start_date
        )
        existing_event.phone = (
            details.phones[0]
            if details.phones
            else existing_event.phone
        )
        existing_event.email = (
            details.emails[0]
            if details.emails
            else existing_event.email
        )
        existing_event.website = page.url
        existing_event.description = parsed.text[:5000]

        db.commit()
        db.refresh(existing_event)

        return existing_event

    event = SportEvent(
        title=parsed.title or "Без названия",
        sport=sport,
        city=details.cities[0] if details.cities else None,
        start_date=parse_first_date(details.dates),
        organizer=None,
        phone=details.phones[0] if details.phones else None,
        email=details.emails[0] if details.emails else None,
        website=page.url,
        source_name="Collector",
        source_url=page.url,
        description=parsed.text[:5000],
    )

    db.add(event)
    db.commit()
    db.refresh(event)

    return event
@router.post(
    "/links",
    response_model=CollectLinksResponse,
)
def collect_links(
    payload: CollectUrlRequest,
) -> CollectLinksResponse:
    if payload.use_browser:
        collector = BrowserCollector(
            ignore_https_errors=payload.ignore_https_errors,
        )
    else:
        collector = HttpCollector()

    parser = LinksParser()

    try:
        page = collector.collect(str(payload.url))
        links = parser.parse(
            html=page.content,
            base_url=page.url,
        )

    except RuntimeError as error:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(error),
        ) from error

    return CollectLinksResponse(
        page_url=page.url,
        links=[
            CollectedLink(
                text=link.text,
                url=link.url,
            )
            for link in links
        ],
    )
@router.post(
    "/crawl",
    response_model=CrawlResponse,
)
def crawl_site(
    payload: CrawlRequest,
) -> CrawlResponse:
    crawler = SiteCrawler(
        max_depth=payload.max_depth,
        max_pages=payload.max_pages,
        use_browser=payload.use_browser,
        ignore_https_errors=payload.ignore_https_errors,
    )

    result = crawler.crawl(str(payload.url))

    return CrawlResponse(
        start_url=result.start_url,
        pages=[
            CrawledPageResponse(
                url=page.url,
                status_code=page.status_code,
                depth=page.depth,
            )
            for page in result.pages
        ],
        documents=[
            CollectedLink(
                text=document.text,
                url=document.url,
            )
            for document in result.documents
        ],
    )