from datetime import date
from decimal import Decimal
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

CapacityUnit = Literal["person_hours", "machine_hours", "team_hours", "milestone", "item", "linear_meter"]
Hours = Annotated[Decimal, Field(ge=0, max_digits=14, decimal_places=4)]


class CapacitySettingsUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    staff_count: int | None = Field(default=None, ge=0, le=10000)
    hours_per_day: Hours | None = Field(default=None, le=24)
    working_days: list[Annotated[int, Field(ge=0, le=6)]] = Field(max_length=7)
    work_center_id: int | None = Field(default=None, gt=0)
    note: str | None = Field(default=None, max_length=2000)

    @field_validator("working_days")
    @classmethod
    def unique_days(cls, days: list[int]) -> list[int]:
        if len(days) != len(set(days)):
            raise ValueError("Рабочие дни не должны повторяться")
        return sorted(days)


class CapacityExceptionUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    capacity: Hours | None = None
    unavailable: bool = False
    note: str | None = Field(default=None, max_length=2000)

    @model_validator(mode="after")
    def validate_mode(self) -> "CapacityExceptionUpdate":
        if self.unavailable == (self.capacity is not None):
            raise ValueError("Для недоступности capacity=null; иначе укажите доступные часы")
        return self


class CapacityExceptionRead(CapacityExceptionUpdate):
    date: date


class CapacityNormRead(BaseModel):
    source: Literal["manual", "confirmed_v0.1", "technical_card_assembly", "milestone"]
    rates: dict[str, Decimal]
    required_staff_count: int | None = None


class CapacityResourceWrite(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str = Field(min_length=1, max_length=255)
    production_stage_id: int = Field(gt=0)
    work_center_id: int | None = Field(default=None, gt=0)
    resource_type: Literal["labor", "machine", "throughput", "milestone"]
    capacity_unit: Literal["labor_hour", "machine_hour", "team_hour", "item", "linear_meter"] | None
    base_rate: Decimal | None = Field(default=None, gt=0, max_digits=14, decimal_places=4)
    resource_count: int | None = Field(default=None, ge=0, le=10000)
    hours_per_day: Hours | None = Field(default=None, le=24)
    shifts_per_day: int = Field(default=1, ge=1, le=24)
    efficiency: Decimal = Field(default=Decimal("1"), ge=0, le=1, max_digits=8, decimal_places=4)
    working_days: list[Annotated[int, Field(ge=0, le=6)]] = Field(max_length=7)
    include_in_calendar_load: bool = True
    calculation_mode: Literal["explicit_hours", "rate", "sewing_norm", "cutting_methods", "team_rate", "milestone"]
    note: str | None = Field(default=None, max_length=2000)

    @model_validator(mode="after")
    def validate_resource(self):
        if isinstance(self, CapacityResourceSummary):
            return self
        if len(self.working_days) != len(set(self.working_days)):
            raise ValueError("working_days must be unique")
        self.working_days.sort()
        if self.hours_per_day is not None and self.hours_per_day * self.shifts_per_day > 24:
            raise ValueError("Total shift hours per day cannot exceed 24")
        if self.resource_type == "milestone":
            if (self.capacity_unit is not None or self.calculation_mode != "milestone"
                    or any(value is not None for value in (self.base_rate, self.resource_count, self.hours_per_day, self.work_center_id))):
                raise ValueError("Milestone has no hourly/throughput capacity")
        elif self.resource_type == "labor":
            labor_units = {"labor_hour", "team_hour"}
            if self.calculation_mode in {"cutting_methods", "team_rate"}:
                labor_units.add("item")
            if self.capacity_unit not in labor_units or self.work_center_id is not None:
                raise ValueError("Labor uses labor_hour/team_hour, or item for cutting/team throughput, without equipment")
        elif self.resource_type == "machine":
            natural_machine = self.capacity_unit in {"linear_meter", "item"} and self.calculation_mode == "rate" and self.base_rate is not None
            if self.capacity_unit != "machine_hour" and not natural_machine:
                raise ValueError("Machine requires machine_hour, or item/linear_meter with a positive hourly rate")
            if self.resource_count not in (None, 1) or self.work_center_id is None:
                raise ValueError("Machine requires one physical WorkCenter")
        elif self.capacity_unit not in {"item", "linear_meter"} or self.work_center_id is not None:
            raise ValueError("Throughput uses item/linear_meter without equipment")
        if self.resource_type != "milestone" and self.calculation_mode == "milestone":
            raise ValueError("milestone mode requires milestone resource")
        if self.resource_type == "throughput" and (self.base_rate is None or self.calculation_mode != "rate"):
            raise ValueError("Throughput requires positive base_rate and rate mode")
        if self.calculation_mode == "rate" and self.base_rate is None:
            raise ValueError("rate mode requires positive base_rate")
        if self.calculation_mode == "sewing_norm" and self.capacity_unit != "labor_hour":
            raise ValueError("sewing_norm requires labor_hour")
        if self.calculation_mode == "cutting_methods" and self.capacity_unit not in {"labor_hour", "item"}:
            raise ValueError("cutting_methods requires labor_hour or item")
        if self.calculation_mode == "team_rate" and (self.capacity_unit not in {"team_hour", "item"} or self.base_rate is None):
            raise ValueError("team_rate requires team_hour or item and a positive base_rate")
        return self


class CapacityResourceSummary(CapacityResourceWrite):
    production_stage_id: int | None
    key: str


class CapacityResourceDetail(CapacityResourceSummary):
    exceptions: list[CapacityExceptionRead] = Field(default_factory=list)


class CapacityResourceRead(CapacitySettingsUpdate):
    key: str
    name: str
    stage_code: str
    production_stage_id: int | None
    stage_name: str | None
    stage_active: bool
    kind: Literal["pool", "machine", "team", "milestone"]
    unit: CapacityUnit
    configured: bool
    base_capacity: Decimal | None
    editable_fields: list[str]
    norm: CapacityNormRead
    exceptions: list[CapacityExceptionRead]


class CapacityStageRead(BaseModel):
    id: int
    name: str
    code: str
    is_active: bool


class CapacityWorkCenterRead(BaseModel):
    id: int
    name: str
    code: str | None
    production_stage_id: int | None
    is_active: bool


class CapacitySettingsRead(BaseModel):
    resources: list[CapacityResourceRead]
    stages: list[CapacityStageRead]
    work_centers: list[CapacityWorkCenterRead]


class CapacityDemand(BaseModel):
    model_config = ConfigDict(extra="forbid")
    unit: CapacityUnit
    hours: Hours | None = None
    quantity: Hours | None = None
    running_meters: Hours | None = None
    technical_card_id: int | None = Field(default=None, gt=0)
    method: Literal["manual_single", "manual_lay"] | None = None


class CapacityLoadRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    resource_key: str = Field(min_length=1, max_length=64)
    date: date
    demands: list[CapacityDemand] = Field(max_length=100)


class CapacityLoadRead(BaseModel):
    resource_key: str
    date: date
    unit: CapacityUnit
    capacity: Decimal | None
    known_planned_hours: Decimal
    unknown_demand_count: int
    load_percent: Decimal | None
    state: Literal["reserve", "near", "over", "unknown"]
    reason: str | None
    warning_only: Literal[True] = True
