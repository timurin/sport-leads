from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.product_model import ProductModelSizeType, ProductModelStatus


class ProductModelBase(BaseModel):
    article: str = Field(min_length=1, max_length=100)
    name: str = Field(min_length=1, max_length=255)
    size_type: ProductModelSizeType
    description: str | None = None
    status: ProductModelStatus = ProductModelStatus.DRAFT

    @field_validator("article", "name", mode="before")
    @classmethod
    def strip_required_text(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value

    @field_validator("description", mode="before")
    @classmethod
    def strip_optional_text(cls, value: object) -> object:
        if isinstance(value, str):
            stripped = value.strip()
            return stripped or None
        return value


class ProductModelCreate(ProductModelBase):
    pass


class ProductModelUpdate(BaseModel):
    article: str | None = Field(default=None, min_length=1, max_length=100)
    name: str | None = Field(default=None, min_length=1, max_length=255)
    size_type: ProductModelSizeType | None = None
    description: str | None = None
    status: ProductModelStatus | None = None

    @field_validator("article", "name", mode="before")
    @classmethod
    def strip_optional_required_text(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value

    @field_validator("description", mode="before")
    @classmethod
    def strip_optional_description(cls, value: object) -> object:
        if isinstance(value, str):
            stripped = value.strip()
            return stripped or None
        return value


class ProductModelRead(ProductModelBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    updated_at: datetime
