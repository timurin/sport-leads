from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.schemas.file_io import FileIoRowError

SEWING_OPERATION_DESCRIPTION_MAX = 256


def _strip_optional_text(value: object) -> object:
    if value is None:
        return None
    if isinstance(value, str):
        stripped = value.strip()
        return stripped or None
    return value


class SewingOperationBase(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=SEWING_OPERATION_DESCRIPTION_MAX)
    folder_id: int | None = None
    sort_order: int = Field(default=0, ge=0)

    @field_validator("name", mode="before")
    @classmethod
    def strip_name(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value

    @field_validator("description", mode="before")
    @classmethod
    def strip_description(cls, value: object) -> object:
        return _strip_optional_text(value)


class SewingOperationCreate(SewingOperationBase):
    work_center_ids: list[int] = Field(default_factory=list)


class SewingOperationUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=SEWING_OPERATION_DESCRIPTION_MAX)
    folder_id: int | None = None
    sort_order: int | None = Field(default=None, ge=0)
    work_center_ids: list[int] | None = None

    @field_validator("name", mode="before")
    @classmethod
    def strip_name(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value

    @field_validator("description", mode="before")
    @classmethod
    def strip_description(cls, value: object) -> object:
        return _strip_optional_text(value)


class SewingOperationRead(SewingOperationBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    work_center_ids: list[int] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime

    @model_validator(mode="before")
    @classmethod
    def extract_work_center_ids(cls, data: object) -> object:
        if hasattr(data, "work_centers"):
            return {
                "id": data.id,
                "name": data.name,
                "description": data.description,
                "folder_id": data.folder_id,
                "sort_order": data.sort_order,
                "work_center_ids": [row.id for row in data.work_centers],
                "created_at": data.created_at,
                "updated_at": data.updated_at,
            }
        return data


class SewingOperationFolderBase(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    parent_id: int | None = None
    sort_order: int = Field(default=0, ge=0)

    @field_validator("name", mode="before")
    @classmethod
    def strip_name(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value


class SewingOperationFolderCreate(SewingOperationFolderBase):
    pass


class SewingOperationFolderUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    parent_id: int | None = None
    sort_order: int | None = Field(default=None, ge=0)

    @field_validator("name", mode="before")
    @classmethod
    def strip_name(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value


class SewingOperationFolderRead(SewingOperationFolderBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    updated_at: datetime


class SewingOperationSiblingMove(BaseModel):
    """Move one step among siblings of the same kind under the same parent."""

    direction: str = Field(pattern="^(up|down)$")


class SewingOperationImportResult(BaseModel):
    """Catalog import dry-run / commit response (4.5.4 / ADR-020)."""

    model_config = ConfigDict(extra="forbid")

    dry_run: bool = True
    total_rows: int = Field(..., ge=0)
    valid_rows: int = Field(..., ge=0)
    error_rows: int = Field(..., ge=0)
    errors: list[FileIoRowError] = Field(default_factory=list)
    preview: list[dict] = Field(default_factory=list)
    can_commit: bool = False
    created_count: int = Field(default=0, ge=0)
    updated_count: int = Field(default=0, ge=0)
    created_ids: list[int] = Field(default_factory=list)
    updated_ids: list[int] = Field(default_factory=list)
    created: list[SewingOperationRead] = Field(default_factory=list)
    updated: list[SewingOperationRead] = Field(default_factory=list)
