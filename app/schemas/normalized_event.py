from datetime import date

from pydantic import BaseModel


class NormalizedEvent(BaseModel):
    title: str
    sport: str

    city: str | None = None
    region: str | None = None
    country: str = "Россия"

    start_date: date | None = None
    end_date: date | None = None

    organizer: str | None = None
    phone: str | None = None
    email: str | None = None
    website: str | None = None

    source_name: str
    source_url: str | None = None
    source_document_url: str | None = None
    external_id: str | None = None

    description: str | None = None

    deduplication_key: str | None = None