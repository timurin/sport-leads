from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


class DetailingProductTypeEmbed(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str


class DetailingItemCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    applicability_product_type_ids: list[int] = Field(min_length=1)

    @field_validator("name", mode="before")
    @classmethod
    def strip_name(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value

    @field_validator("applicability_product_type_ids", mode="before")
    @classmethod
    def uniq_ids(cls, value: object) -> object:
        if not isinstance(value, list):
            return value
        out: list[int] = []
        seen: set[int] = set()
        for item in value:
            try:
                parsed = int(item)
            except (TypeError, ValueError):
                continue
            if parsed <= 0 or parsed in seen:
                continue
            seen.add(parsed)
            out.append(parsed)
        return out


class DetailingItemUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    applicability_product_type_ids: list[int] | None = Field(default=None, min_length=1)

    @field_validator("name", mode="before")
    @classmethod
    def strip_name(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value

    @field_validator("applicability_product_type_ids", mode="before")
    @classmethod
    def uniq_ids(cls, value: object) -> object:
        if value is None or not isinstance(value, list):
            return value
        out: list[int] = []
        seen: set[int] = set()
        for item in value:
            try:
                parsed = int(item)
            except (TypeError, ValueError):
                continue
            if parsed <= 0 or parsed in seen:
                continue
            seen.add(parsed)
            out.append(parsed)
        return out


class DetailingItemRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    applicability_product_types: list[DetailingProductTypeEmbed] = Field(
        default_factory=list
    )
    created_at: datetime
    updated_at: datetime
