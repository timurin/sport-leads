"""Workshop queue is an operation order; Calendar and production fact stay separate."""
from datetime import date

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.production_diagnostics import ProductionDiagnostic
from app.schemas.production_schedule import ScheduleRead


class WorkshopQueueItem(BaseModel):
    technical_card_id: int
    technical_card_number: str
    snapshot_node_id: int
    workshop_id: int
    workshop_name: str
    operation_id: int
    operation_name: str
    queue_position: int
    priority: int | None
    planned_start: date | None
    planned_end: date | None
    eta: date | None
    shipping_date: date | None
    risk: str
    status: str = "waiting"
    protected: bool = False
    read_only: bool = False


class WorkshopQueueRead(BaseModel):
    workshop_id: int
    revision: str
    items: list[WorkshopQueueItem]


class WorkshopQueueReorder(BaseModel):
    model_config = ConfigDict(extra="forbid")
    ordered_snapshot_node_ids: list[int] = Field(max_length=500)
    revision: str = Field(min_length=64, max_length=64)


class WorkshopQueueApply(WorkshopQueueReorder):
    preview_fingerprint: str = Field(min_length=64, max_length=64)


class WorkshopQueueChange(BaseModel):
    snapshot_node_id: int
    technical_card_id: int
    old_position: int
    new_position: int
    old_planned_start: date | None
    new_planned_start: date | None
    old_planned_end: date | None
    new_planned_end: date | None
    old_eta: date | None
    new_eta: date | None
    old_risk: str
    new_risk: str
    downstream_snapshot_node_ids: list[int]


class WorkshopQueuePreview(BaseModel):
    workshop_id: int
    revision: str
    preview_fingerprint: str
    can_apply: bool
    changes: list[WorkshopQueueChange] = Field(default_factory=list)
    warnings: list[ProductionDiagnostic] = Field(default_factory=list)
    blockers: list[ProductionDiagnostic] = Field(default_factory=list)
    affected_plans: list[ScheduleRead] = Field(default_factory=list)


class WorkshopQueueApplied(BaseModel):
    queue: WorkshopQueueRead
    preview: WorkshopQueuePreview
    audit_event_id: int | None = None
