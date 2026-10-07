from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class AssignmentCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    technical_card_id: int = Field(gt=0)
    planned_date: date
    note: str | None = Field(default=None, max_length=2000)


class AssignmentUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    production_stage_id: int = Field(gt=0)
    planned_date: date | None = None
    planned_start_date: date | None = None
    planned_end_date: date | None = None
    position: int = Field(default=0, ge=0)
    note: str | None = Field(default=None, max_length=2000)
    routing_stage_line_id: int | None = Field(default=None, gt=0)
    planning_mode: Literal["auto", "manual_adjusted", "locked"] | None = None

    @model_validator(mode="after")
    def validate_range(self):
        if "planning_mode" in self.model_fields_set and self.planning_mode is None:
            raise ValueError("planning_mode cannot be null")
        if any(getattr(self, key) is None for key in self.model_fields_set
               if key in {"planned_date", "planned_start_date", "planned_end_date"}):
            raise ValueError("Dates cannot be null")
        start = self.planned_start_date or self.planned_date
        if start is None:
            raise ValueError("planned_start_date or planned_date is required")
        if self.planned_date is not None and self.planned_start_date is not None and self.planned_date != self.planned_start_date:
            raise ValueError("planned_date must equal planned_start_date")
        end = self.planned_end_date or start
        if end < start:
            raise ValueError("planned_end_date must be >= planned_start_date")
        self.planned_date = self.planned_start_date = start
        self.planned_end_date = end
        return self


class AssignmentRead(AssignmentCreate):
    planned_start_date: date
    planned_end_date: date
    id: int
    production_stage_id: int = Field(gt=0)
    position: int = Field(ge=0)
    routing_stage_line_id: int | None = None
    planning_mode: Literal["auto", "manual_adjusted", "locked"]
    manual_lock: bool
    technical_card_number: str
    order_number: str
    nomenclature_name: str | None
    production_stage_name: str
    quantity: Decimal
    created_at: datetime
    updated_at: datetime


class CalendarSourceRead(BaseModel):
    id: int
    number: str
    order_number: str
    nomenclature_name: str | None
    quantity: Decimal


class CalendarStageRead(BaseModel):
    id: int
    name: str
    code: str


class CalendarBoardRead(BaseModel):
    assignments: list[AssignmentRead]
    stages: list[CalendarStageRead]
