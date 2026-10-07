"""Read-only ResourceDemand response. Amounts are decimal strings, not floats."""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

DemandStatus = Literal["ready", "missing_input", "manual_required", "not_applicable"]
DemandUnit = Literal["labor_hour", "machine_hour", "team_hour", "item", "linear_meter"]
DemandSource = Literal[
    "sewing_operation_times",
    "technical_card_quantity",
    "technical_card_linear_meters",
    "fixed_per_card",
    "fixed_per_batch",
    "manual",
    "milestone",
]


class ResourceDemandRead(BaseModel):
    model_config = ConfigDict(extra="forbid")

    technical_card_id: int
    routing_stage_line_id: int
    operation_id: int
    resource_key: str
    amount: str | None = None
    unit: DemandUnit | None = None
    status: DemandStatus
    source_type: DemandSource | None = None
    details: dict[str, object] = Field(default_factory=dict)


class DemandIssueRead(BaseModel):
    model_config = ConfigDict(extra="forbid")

    reason_code: str
    technical_card_id: int
    routing_stage_line_id: int | None = None
    operation_id: int | None = None
    resource_key: str | None = None


class StepDemandRead(BaseModel):
    model_config = ConfigDict(extra="forbid")

    technical_card_id: int
    routing_stage_line_id: int
    stage_order: int
    stage_label: str
    operation_id: int | None = None
    operation_name: str | None = None
    status: DemandStatus
    demands: list[ResourceDemandRead]
    issues: list[DemandIssueRead]


class CardDemandRead(BaseModel):
    model_config = ConfigDict(extra="forbid")

    technical_card_id: int
    status: DemandStatus
    steps: list[StepDemandRead]
    issues: list[DemandIssueRead]
