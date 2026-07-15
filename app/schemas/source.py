from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, HttpUrl


SourceType = Literal[
    "html",
    "pdf",
    "xlsx",
    "crawler",
    "mock",
]


class SourceBase(BaseModel):
    name: str = Field(
        min_length=1,
        max_length=255,
    )

    url: HttpUrl

    source_type: SourceType = "html"

    sport: str = Field(
        default="Все",
        min_length=1,
        max_length=100,
    )

    city: str = Field(
        default="Все",
        min_length=1,
        max_length=150,
    )

    use_browser: bool = False
    ignore_https_errors: bool = False
    is_active: bool = True
    description: str | None = None


class SourceCreate(SourceBase):
    pass


class SourceUpdate(BaseModel):
    name: str | None = Field(
        default=None,
        min_length=1,
        max_length=255,
    )

    url: HttpUrl | None = None
    source_type: SourceType | None = None

    sport: str | None = Field(
        default=None,
        min_length=1,
        max_length=100,
    )

    city: str | None = Field(
        default=None,
        min_length=1,
        max_length=150,
    )

    use_browser: bool | None = None
    ignore_https_errors: bool | None = None
    is_active: bool | None = None
    description: str | None = None


class SourceRead(SourceBase):
    model_config = ConfigDict(
        from_attributes=True,
    )

    id: int
    created_at: datetime
    updated_at: datetime