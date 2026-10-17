from datetime import date
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field
from app.schemas.production_diagnostics import ProductionDiagnostic
from app.schemas.production_schedule import ScheduleRead, ScheduledAllocation
from app.schemas.persisted_plan import PersistedPlanSummary


class ManualReplanRequest(BaseModel):
    model_config = ConfigDict(extra='forbid')
    technical_card_id: int = Field(gt=0)
    snapshot_node_id: int = Field(gt=0)
    target_date: date
    mode: Literal['single', 'downstream']
    revision: str | None = Field(default=None, pattern=r'^[a-f0-9]{64}$')


class ManualReplanApply(ManualReplanRequest):
    revision: str = Field(pattern=r'^[a-f0-9]{64}$')
    preview_fingerprint: str = Field(pattern=r'^[a-f0-9]{64}$')


class ManualReplanChange(BaseModel):
    assignment_id: int
    snapshot_node_id: int
    operation_name: str
    workshop_id: int
    workshop_name: str
    old_start: date
    old_end: date
    new_start: date
    new_end: date
    old_allocations: list[ScheduledAllocation]
    new_allocations: list[ScheduledAllocation]
    reason: Literal['selected_date', 'downstream_dependency']


class ManualReplanPreview(BaseModel):
    technical_card_id: int
    snapshot_node_id: int
    target_date: date
    mode: Literal['single', 'downstream']
    revision: str
    preview_fingerprint: str = ''
    apply_allowed: bool = False
    old_selected_start: date | None = None
    old_selected_end: date | None = None
    new_selected_start: date | None = None
    new_selected_end: date | None = None
    selected_operation: ManualReplanChange | None = None
    affected_assignments: list[ManualReplanChange] = Field(default_factory=list)
    downstream_snapshot_node_ids: list[int] = Field(default_factory=list)
    old_eta: date | None = None
    new_eta: date | None = None
    shipping_date: date | None = None
    old_slack: int | None = None
    new_slack: int | None = None
    risk_before: str = 'unknown'
    risk_after: str = 'unknown'
    capacity_warnings: list[ProductionDiagnostic] = Field(default_factory=list)
    dependency_warnings: list[ProductionDiagnostic] = Field(default_factory=list)
    blockers: list[ProductionDiagnostic] = Field(default_factory=list)
    plan: ScheduleRead | None = None


class ManualReplanApplied(BaseModel):
    preview: ManualReplanPreview
    planning_summary: PersistedPlanSummary
    audit_event_id: int
