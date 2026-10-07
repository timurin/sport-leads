from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

CapacityUnit = Literal["labor_hour", "machine_hour", "team_hour", "item", "linear_meter"]


class CalendarAllocationCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    assignment_id: int = Field(gt=0)
    resource_key: str = Field(min_length=1, max_length=64)
    date: date
    allocated_amount: Decimal = Field(gt=0, max_digits=14, decimal_places=4)
    capacity_unit: CapacityUnit


class CalendarAllocationRead(CalendarAllocationCreate):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    updated_at: datetime
