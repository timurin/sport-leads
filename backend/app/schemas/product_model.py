from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.product_model import (
    ProductModelSizeType,
    ProductModelStatus,
    ProductModelVersionState,
)


class ProductModelBase(BaseModel):
    article: str = Field(min_length=1, max_length=100)
    name: str = Field(min_length=1, max_length=255)
    size_type: ProductModelSizeType
    description: str | None = None
    cover_image_url: str | None = Field(default=None, max_length=500)
    status: ProductModelStatus = ProductModelStatus.DRAFT

    @field_validator("article", "name", mode="before")
    @classmethod
    def strip_required_text(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value

    @field_validator("description", "cover_image_url", mode="before")
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
    cover_image_url: str | None = Field(default=None, max_length=500)

    @field_validator("article", "name", mode="before")
    @classmethod
    def strip_optional_required_text(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value

    @field_validator("description", "cover_image_url", mode="before")
    @classmethod
    def strip_optional_text(cls, value: object) -> object:
        if isinstance(value, str):
            stripped = value.strip()
            return stripped or None
        return value


class ProductModelRead(ProductModelBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    updated_at: datetime


class ProductModelVersionCreate(BaseModel):
    label: str | None = Field(default=None, max_length=100)
    note: str | None = None
    source_version_id: int | None = None

    @field_validator("label", "note", mode="before")
    @classmethod
    def strip_optional_text(cls, value: object) -> object:
        if isinstance(value, str):
            stripped = value.strip()
            return stripped or None
        return value


class ProductModelVersionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    product_model_id: int
    version_number: int
    label: str | None
    state: ProductModelVersionState
    note: str | None
    published_at: datetime | None
    created_at: datetime
    updated_at: datetime


class ProductModelCoverUpload(BaseModel):
    filename: str = Field(min_length=1, max_length=255)
    mime_type: str = Field(pattern=r"^image/(jpeg|png|webp)$")
    content_base64: str = Field(min_length=1)


class ProductModelMediaCreate(BaseModel):
    filename: str = Field(min_length=1, max_length=255)
    mime_type: str = Field(pattern=r"^image/(jpeg|png|webp)$")
    content_base64: str = Field(min_length=1)
    is_primary: bool = False


class ProductModelMediaUpdate(BaseModel):
    is_primary: bool | None = None


class ProductModelMediaRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    product_model_id: int
    filename: str
    mime_type: str
    file_size: int
    sort_order: int
    is_primary: bool
    created_at: datetime
    updated_at: datetime
    content_url: str


class ProductModelHistoryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    product_model_id: int
    actor: str
    action: str
    created_at: datetime


class NomenclatureProductModelCreate(BaseModel):
    product_model_id: int
    sort_order: int | None = Field(default=None, ge=0)


class NomenclatureProductModelReorder(BaseModel):
    product_model_ids: list[int] = Field(min_length=1)


class NomenclatureProductModelRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    nomenclature_id: int
    product_model_id: int
    sort_order: int
    created_at: datetime
    updated_at: datetime
    article: str
    name: str
    size_type: ProductModelSizeType
    status: ProductModelStatus
