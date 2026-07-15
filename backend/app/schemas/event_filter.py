from datetime import date

from pydantic import BaseModel, Field, model_validator


class EventFilterRequest(BaseModel):
    period_start: date | None = None
    period_end: date | None = None

    sport: str = Field(default="Все")
    city: str = Field(default="Все")

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