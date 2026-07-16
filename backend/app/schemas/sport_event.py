from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, EmailStr, HttpUrl


class SportEventBase(BaseModel):
    title: str
    sport: str

    city: str | None = None
    region: str | None = None
    country: str = "Россия"

    start_date: date | None = None
    end_date: date | None = None

    organizer: str | None = None
    phone: str | None = None
    email: EmailStr | None = None
    website: HttpUrl | None = None

    source_name: str | None = None
    source_url: HttpUrl | None = None
    description: str | None = None


class SportEventCreate(SportEventBase):
    pass


class SportEventUpdate(BaseModel):
    title: str | None = None
    sport: str | None = None

    city: str | None = None
    region: str | None = None
    country: str | None = None

    start_date: date | None = None
    end_date: date | None = None

    organizer: str | None = None
    phone: str | None = None
    email: EmailStr | None = None
    website: HttpUrl | None = None

    source_name: str | None = None
    source_url: HttpUrl | None = None
    description: str | None = None


class SportEventRead(SportEventBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    updated_at: datetime