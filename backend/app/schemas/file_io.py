"""Shared file I/O DTOs for catalog/domain import (ADR-020 contour A/B helpers).

No section-specific SoT — adapters map rows after parse/validate.
"""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class FileIoRowError(BaseModel):
    """One row- or header-level validation/parse error."""

    model_config = ConfigDict(extra="forbid")

    row_number: int = Field(
        ...,
        description="1-based data row index (header is not counted). Use 0 for header/file-level errors.",
        ge=0,
    )
    column: str | None = None
    code: str
    message: str


class ParsedTable(BaseModel):
    """Normalized tabular payload after CSV/XLSX parse."""

    model_config = ConfigDict(extra="forbid")

    headers: list[str]
    rows: list[dict[str, str | None]]
    source_format: Literal["csv", "xlsx"]
    sheet_name: str | None = None


class FileIoDryRunEnvelope(BaseModel):
    """Generic dry-run / commit preview envelope for section adapters."""

    model_config = ConfigDict(extra="forbid")

    dry_run: bool = True
    total_rows: int = Field(..., ge=0)
    valid_rows: int = Field(..., ge=0)
    error_rows: int = Field(..., ge=0)
    errors: list[FileIoRowError] = Field(default_factory=list)
    preview: list[dict[str, Any]] = Field(default_factory=list)
    can_commit: bool = False
