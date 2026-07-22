from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.size_grid import SizeGridSizeType


class SizeGridRowRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    sort_order: int
    ru_size: str
    int_label: str
    chest: str
    waist: str
    hip: str
    height_s: str | None = None
    height_n: str | None = None
    height_t: str | None = None


class SizeGridRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    size_type: SizeGridSizeType
    source_note: str | None = None
    created_at: datetime
    updated_at: datetime
    rows: list[SizeGridRowRead] = Field(default_factory=list)


class SizeGridListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    size_type: SizeGridSizeType
    source_note: str | None = None
    row_count: int = 0
    created_at: datetime
    updated_at: datetime
