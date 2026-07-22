from datetime import datetime
from decimal import Decimal

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
    size_grid_id: int | None = None
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
    size_grid_id: int | None = None
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
    has_journal_operations: bool = False


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


class AssemblyOperationLineBase(BaseModel):
    operation_name: str = Field(min_length=1, max_length=255)
    cost: Decimal = Field(default=Decimal("0"), ge=0, max_digits=14, decimal_places=2)
    sequence: int | None = Field(default=None, ge=1)

    @field_validator("operation_name", mode="before")
    @classmethod
    def strip_operation_name(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value


class AssemblyOperationLineCreate(AssemblyOperationLineBase):
    sewing_operation_id: int | None = None


class AssemblyOperationLineUpdate(BaseModel):
    operation_name: str | None = Field(default=None, min_length=1, max_length=255)
    cost: Decimal | None = Field(default=None, ge=0, max_digits=14, decimal_places=2)
    sequence: int | None = Field(default=None, ge=1)

    @field_validator("operation_name", mode="before")
    @classmethod
    def strip_operation_name(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value


class AssemblyOperationLineRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    assembly_variant_id: int
    sequence: int
    operation_name: str
    cost: Decimal
    sewing_operation_id: int | None = None
    created_at: datetime
    updated_at: datetime


class AssemblyOperationLineReorder(BaseModel):
    operation_line_ids: list[int] = Field(min_length=1)


class AssemblyVariantCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    is_active: bool = True
    sort_order: int | None = Field(default=None, ge=0)
    operation_lines: list[AssemblyOperationLineCreate] = Field(default_factory=list)
    sewing_operation_ids: list[int] = Field(default_factory=list)

    @field_validator("name", mode="before")
    @classmethod
    def strip_name(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value


class AssemblyVariantAddSewingOperations(BaseModel):
    sewing_operation_ids: list[int] = Field(min_length=1)


class AssemblyVariantUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    is_active: bool | None = None
    sort_order: int | None = Field(default=None, ge=0)

    @field_validator("name", mode="before")
    @classmethod
    def strip_name(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value


class AssemblyVariantRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    product_model_id: int
    name: str
    is_active: bool
    sort_order: int
    total_cost: Decimal
    operation_lines: list[AssemblyOperationLineRead]
    created_at: datetime
    updated_at: datetime


class AssemblyVariantReorder(BaseModel):
    assembly_variant_ids: list[int] = Field(min_length=1)
