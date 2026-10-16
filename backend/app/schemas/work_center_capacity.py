from datetime import date
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class WorkCenterCapacityWrite(BaseModel):
    model_config = ConfigDict(extra="forbid")
    capacity_unit: Literal["item", "linear_meter", "machine_hour"]
    base_rate: Decimal | None = Field(default=None, gt=0, max_digits=14, decimal_places=4)
    hours_per_day: Decimal | None = Field(default=None, ge=0, le=24, max_digits=8, decimal_places=4)
    shifts_per_day: int = Field(default=1, ge=1, le=24)
    efficiency: Decimal = Field(default=Decimal(1), ge=0, le=1, max_digits=8, decimal_places=4)
    working_days: list[int]
    include_in_calendar_load: bool = True
    note: str | None = Field(default=None, max_length=2000)

    @model_validator(mode="after")
    def validate_capacity(self):
        if self.capacity_unit != "machine_hour" and self.base_rate is None:
            raise ValueError("Throughput equipment requires a positive hourly rate")
        if self.capacity_unit == "machine_hour" and self.base_rate is not None:
            raise ValueError("machine_hour is explicit time, not a throughput rate")
        if len(self.working_days) != len(set(self.working_days)) or any(day not in range(7) for day in self.working_days):
            raise ValueError("working_days must be unique weekdays 0..6")
        if self.hours_per_day is not None and self.hours_per_day * self.shifts_per_day > 24:
            raise ValueError("Total shift hours cannot exceed 24")
        return self


class WorkCenterAllocationRead(BaseModel):
    work_center_id: int
    resource_key: str
    assignment_id: int
    technical_card_id: int
    date: date
    allocated_amount: Decimal
    capacity_unit: str


class WorkCenterDayLoadRead(BaseModel):
    work_center_id: int
    resource_key: str
    date: date
    capacity_unit: str
    configured_capacity: Decimal | None
    allocated: Decimal
    remaining: Decimal | None
    utilization_percent: Decimal | None
