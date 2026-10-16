"""Derived production lifecycle; no persisted enum/state table."""
from typing import Literal
from pydantic import BaseModel, Field
from app.schemas.production_diagnostics import ProductionDiagnostic


class ProductionState(BaseModel):
    lifecycle_status: Literal['draft','planned','in_progress','completed','cancelled'] = 'draft'
    current_workshop_id: int | None = None
    current_workshop_name: str | None = None
    workshop_state: Literal['waiting','in_progress','completed'] = 'waiting'
    current_snapshot_nodes: list[int] = Field(default_factory=list)
    ready_snapshot_nodes: list[int] = Field(default_factory=list)
    current_stage_order: int | None = None
    current_stage_label: str | None = None
    next_workshop_id: int | None = None
    has_started_fact: bool = False
    has_completed_fact: bool = False
    planning_state: Literal['unplanned','partial','planned','stale','invalid','unknown'] = 'unknown'
    diagnostics: list[ProductionDiagnostic] = Field(default_factory=list)
