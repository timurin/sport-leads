"""Canonical read-only planning projection; list DTO deliberately has no route array."""
from datetime import date
from typing import Literal

from pydantic import BaseModel, Field

PlanningHealthState = Literal['not_planned', 'actual', 'stale', 'invalid', 'completed']
PlanningRisk = Literal['unknown', 'on_time', 'late']


class PlanningHealthSummary(BaseModel):
    technical_card_id: int
    planning_date: date
    planning_state: PlanningHealthState
    replan_required: bool = False
    eta: date | None = None
    shipping_date: date | None = None
    slack_days: int | None = None
    on_time: bool | None = None
    risk_level: PlanningRisk = 'unknown'
    current_workshop_id: int | None = None
    current_workshop_name: str | None = None
    route_total_operations: int = 0
    completed_operations: int = 0
    in_progress_operations: int = 0
    pending_operations: int = 0
    has_overdue_operations: bool = False
    overdue_operation_count: int = 0
    earliest_overdue_operation: str | None = None
    earliest_overdue_snapshot_node_id: int | None = None
    earliest_overdue_workshop: str | None = None
    earliest_overdue_date: date | None = None
    overdue_days: int = 0
    next_operation: str | None = None
    next_snapshot_node_id: int | None = None
    next_operation_date: date | None = None
    has_planning_issues: bool = False


class OperationPlanningHealth(BaseModel):
    snapshot_node_id: int
    operation_name: str
    workshop_id: int | None = None
    workshop_name: str
    operation_status: str
    planned_start: date | None = None
    planned_end: date | None = None
    is_overdue: bool = False
    overdue_days: int = 0
    is_protected: bool = False
    can_replan: bool = False
    warning_code: str | None = None


class PlanningHealth(PlanningHealthSummary):
    operations: list[OperationPlanningHealth] = Field(default_factory=list)


class ManualPlanningCardHealth(PlanningHealthSummary):
    number: str
