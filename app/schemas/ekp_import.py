from datetime import date

from pydantic import BaseModel, Field, HttpUrl, model_validator


class EkpImportRequest(BaseModel):
    document_url: HttpUrl

    sport: str = Field(default="Все")
    city: str = Field(default="Все")

    period_start: date | None = None
    period_end: date | None = None

    max_pages: int | None = Field(
        default=None,
        ge=1,
    )

    ignore_https_errors: bool = False

    @model_validator(mode="after")
    def validate_period(self):
        if (
            self.period_start is not None
            and self.period_end is not None
            and self.period_start > self.period_end
        ):
            raise ValueError(
                "Дата начала периода не может быть позже даты окончания"
            )

        return self


class EkpImportResponse(BaseModel):
    document_url: str
    parsed: int
    received: int
    filtered_out: int
    created: int
    duplicates: int
    failed: int