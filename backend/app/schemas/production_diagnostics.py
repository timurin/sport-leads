"""One additive, read-only diagnostic contract for all production surfaces."""
from typing import Literal
from datetime import date, datetime
from pydantic import BaseModel, ConfigDict, Field, JsonValue

DiagnosticCategory = Literal["CONFIGURATION", "DATA_FLOW", "RUNTIME", "INTEGRITY"]


class DiagnosticTraceStep(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)
    source: str
    value: JsonValue = None
    broken: bool = False


class ProductionDiagnostic(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)
    code: str
    severity: Literal["error", "warning", "info"] = "error"
    entity_type: str
    entity_id: int | str
    entity_name: str
    field: str
    field_label: str
    message: str
    fix_scope: str
    operation_id: int | None = None
    resource_key: str | None = None
    category: DiagnosticCategory = "CONFIGURATION"
    module: str = "production"
    expected_source: str | None = None
    source_value: JsonValue = None
    actual_value: JsonValue = None
    formula: str | None = None
    trace: tuple[DiagnosticTraceStep, ...] = ()
    reason: str | None = None
    fix_action: str | None = None
    fix_url: str | None = None
    fix_target: dict[str, str | int] = Field(default_factory=dict)
    debug_details: dict[str, JsonValue] = Field(default_factory=dict)


class CalendarAssignmentSummary(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)
    calendar_assignment_id: int
    snapshot_node_id: int | None
    routing_stage_line_id: int | None
    workshop_id: int
    planning_mode: str
    planned_start: date
    planned_end: date
    manual_lock: bool
    created_at: datetime | None
    updated_at: datetime | None
    allocation_count: int


class ProductionDiagnosticsRead(BaseModel):
    status: Literal["ready", "blocked"]
    diagnostics: tuple[ProductionDiagnostic, ...] = ()
    calendar_assignments: tuple[CalendarAssignmentSummary, ...] = ()


class PlatformHealthRead(BaseModel):
    scope: str = "production"
    total: int
    counts_by_category: dict[str, int]
    counts_by_module: dict[str, int]
    counts_by_severity: dict[str, int]
    limit: int
    offset: int
    diagnostics: tuple[ProductionDiagnostic, ...]
