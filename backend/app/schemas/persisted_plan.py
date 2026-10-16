from datetime import date
from typing import Literal
from pydantic import BaseModel


class PersistedPlanSummary(BaseModel):
    planning_state: Literal['unplanned', 'partial', 'planned', 'stale', 'invalid', 'unknown']
    persisted: bool = True
    is_current: bool = False
    replan_required: bool = False
    planned_start_date: date | None = None
    planned_completion_date: date | None = None
    shipping_date: date | None = None
    on_time: bool | None = None
    buffer_days: int | None = None
    delay_days: int | None = None
