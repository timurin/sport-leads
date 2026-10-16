from datetime import date
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field


class ScheduleDeviation(BaseModel):
    code: str
    reason: str
    routing_stage_line_id: int | None = None
    resource_key: str | None = None


class ScheduledAllocation(BaseModel):
    resource_key: str
    date: date
    allocated_amount: Decimal
    capacity_unit: str
    work_center_id: int | None = None


class ScheduledStep(BaseModel):
    routing_stage_line_id: int
    snapshot_node_id: int | None = None
    production_stage_id: int
    planned_start_date: date
    planned_end_date: date
    preserved: bool = False
    assignment_id: int | None = None
    allocations: list[ScheduledAllocation] = Field(default_factory=list)


class ScheduleRead(BaseModel):
    technical_card_id: int
    status: Literal["planned", "blocked"]
    persisted: bool = False
    planning_from: date
    horizon_end: date
    planned_completion_date: date | None = None
    on_time: bool | None = None
    buffer_days: int | None = None
    delay_days: int | None = None
    steps: list[ScheduledStep] = Field(default_factory=list)
    deviations: list[ScheduleDeviation] = Field(default_factory=list)


class QueueCardScheduleRead(BaseModel):
    technical_card_id: int
    technical_card_number: str
    priority: int | None
    status: Literal["planned", "blocked"]
    persisted: bool = False
    preserved: bool = False
    planned_completion_date: date | None = None
    on_time: bool | None = None
    buffer_days: int | None = None
    delay_days: int | None = None
    steps_count: int = 0
    deviations: list[ScheduleDeviation] = Field(default_factory=list)


class QueueScheduleRead(BaseModel):
    status: Literal["planned", "partial", "blocked", "empty"]
    total_cards: int
    planned_cards: int
    blocked_cards: int
    deadline_missed_cards: int
    preserved_cards: int
    results: list[QueueCardScheduleRead] = Field(default_factory=list)
