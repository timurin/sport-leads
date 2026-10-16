"""Manager-facing roadmap; source diagnostics remain available for Debug."""
from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.production_diagnostics import ProductionDiagnostic


class ReadinessIssue(BaseModel):
    code: str
    severity: Literal["error", "warning", "info"] = "error"
    message: str
    fix_action: str | None = None
    fix_url: str | None = None
    diagnostic: ProductionDiagnostic | None = None


class ReadinessStep(BaseModel):
    code: str
    title: str
    status: Literal["completed", "warning", "blocked", "pending"]
    summary: str
    issues: list[ReadinessIssue] = Field(default_factory=list)
    fix_action: str | None = None
    fix_url: str | None = None
    blocking: bool = False


class TechnicalCardReadiness(BaseModel):
    technical_card_id: int
    lifecycle_status: str
    overall_status: Literal["ready", "warning", "blocked", "incomplete", "completed"]
    can_launch: bool
    progress_completed: int
    progress_total: int = 7
    steps: list[ReadinessStep]
