from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, HttpUrl


SourceType = Literal["html", "pdf", "xlsx", "crawler"]


class SourceBase(BaseModel):
    name: str
    url: HttpUrl

    source_type: SourceType = "html"

    sport: str = "Все"
    city: str = "Все"

    use_browser: bool = False
    ignore_https_errors: bool = False
    is_active: bool = True

    description: str | None = None


class SourceCreate(SourceBase):
    pass


class SourceUpdate(BaseModel):
    name: str | None = None
    url: HttpUrl | None = None

    source_type: SourceType | None = None

    sport: str | None = None
    city: str | None = None

    use_browser: bool | None = None
    ignore_https_errors: bool | None = None
    is_active: bool | None = None

    description: str | None = None


class SourceRead(SourceBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    updated_at: datetime