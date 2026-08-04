from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.size_grid import SizeGridSizeType


def _strip_required(value: object) -> object:
    if isinstance(value, str):
        return value.strip()
    return value


def _strip_optional(value: object) -> object:
    if isinstance(value, str):
        trimmed = value.strip()
        return trimmed or None
    return value


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


class SizeGridRowWrite(BaseModel):
    sort_order: int = Field(default=0, ge=0)
    ru_size: str = Field(min_length=1, max_length=32)
    int_label: str = Field(min_length=1, max_length=32)
    chest: str = Field(min_length=1, max_length=64)
    waist: str = Field(min_length=1, max_length=64)
    hip: str = Field(min_length=1, max_length=64)
    height_s: str | None = Field(default=None, max_length=64)
    height_n: str | None = Field(default=None, max_length=64)
    height_t: str | None = Field(default=None, max_length=64)

    @field_validator(
        "ru_size",
        "int_label",
        "chest",
        "waist",
        "hip",
        mode="before",
    )
    @classmethod
    def strip_required_fields(cls, value: object) -> object:
        return _strip_required(value)

    @field_validator("height_s", "height_n", "height_t", mode="before")
    @classmethod
    def strip_optional_heights(cls, value: object) -> object:
        return _strip_optional(value)


class SizeGridRowUpdate(BaseModel):
    sort_order: int | None = Field(default=None, ge=0)
    ru_size: str | None = Field(default=None, min_length=1, max_length=32)
    int_label: str | None = Field(default=None, min_length=1, max_length=32)
    chest: str | None = Field(default=None, min_length=1, max_length=64)
    waist: str | None = Field(default=None, min_length=1, max_length=64)
    hip: str | None = Field(default=None, min_length=1, max_length=64)
    height_s: str | None = Field(default=None, max_length=64)
    height_n: str | None = Field(default=None, max_length=64)
    height_t: str | None = Field(default=None, max_length=64)

    @field_validator(
        "ru_size",
        "int_label",
        "chest",
        "waist",
        "hip",
        mode="before",
    )
    @classmethod
    def strip_required_fields(cls, value: object) -> object:
        return _strip_required(value)

    @field_validator("height_s", "height_n", "height_t", mode="before")
    @classmethod
    def strip_optional_heights(cls, value: object) -> object:
        return _strip_optional(value)


class SizeGridCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    size_type: SizeGridSizeType
    source_note: str | None = None
    rows: list[SizeGridRowWrite] = Field(default_factory=list)

    @field_validator("name", mode="before")
    @classmethod
    def strip_name(cls, value: object) -> object:
        return _strip_required(value)

    @field_validator("source_note", mode="before")
    @classmethod
    def strip_source_note(cls, value: object) -> object:
        return _strip_optional(value)


class SizeGridUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    source_note: str | None = None

    @field_validator("name", mode="before")
    @classmethod
    def strip_name(cls, value: object) -> object:
        return _strip_required(value)

    @field_validator("source_note", mode="before")
    @classmethod
    def strip_source_note(cls, value: object) -> object:
        return _strip_optional(value)


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
