from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class NomenclatureMediaCreate(BaseModel):
    filename: str = Field(min_length=1, max_length=255)
    mime_type: str = Field(pattern=r"^image/(jpeg|png|webp|svg\+xml)$")
    content_base64: str = Field(min_length=1)
    alt_text: str | None = Field(default=None, max_length=255)
    sort_order: int = Field(default=0, ge=0)
    is_primary: bool = False


class NomenclatureMediaUpdate(BaseModel):
    alt_text: str | None = Field(default=None, max_length=255)
    sort_order: int | None = Field(default=None, ge=0)
    is_primary: bool | None = None


class NomenclatureMediaRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    nomenclature_id: int
    filename: str
    mime_type: str
    file_size: int
    alt_text: str | None
    sort_order: int
    is_primary: bool
    created_at: datetime
    updated_at: datetime
    content_url: str
