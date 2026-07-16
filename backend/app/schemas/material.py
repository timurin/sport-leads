from datetime import datetime
from decimal import Decimal

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
)


class MaterialBase(BaseModel):
    name: str = Field(
        min_length=1,
        max_length=255,
    )

    article: str = Field(
        min_length=1,
        max_length=100,
    )

    category: str = Field(
        min_length=1,
        max_length=100,
    )

    unit: str = Field(
        min_length=1,
        max_length=30,
    )

    balance: Decimal = Field(
        default=Decimal("0"),
        ge=0,
    )

    minimum_balance: Decimal = Field(
        default=Decimal("0"),
        ge=0,
    )

    warehouse: str | None = Field(
        default=None,
        max_length=255,
    )

    description: str | None = None

    is_active: bool = True

    @field_validator(
        "name",
        "article",
        "category",
        "unit",
        "warehouse",
        mode="before",
    )
    @classmethod
    def strip_text(
        cls,
        value: object,
    ) -> object:
        if isinstance(value, str):
            stripped = value.strip()
            return stripped or None

        return value


class MaterialCreate(MaterialBase):
    pass


class MaterialUpdate(BaseModel):
    name: str | None = Field(
        default=None,
        min_length=1,
        max_length=255,
    )

    article: str | None = Field(
        default=None,
        min_length=1,
        max_length=100,
    )

    category: str | None = Field(
        default=None,
        min_length=1,
        max_length=100,
    )

    unit: str | None = Field(
        default=None,
        min_length=1,
        max_length=30,
    )

    balance: Decimal | None = Field(
        default=None,
        ge=0,
    )

    minimum_balance: Decimal | None = Field(
        default=None,
        ge=0,
    )

    warehouse: str | None = Field(
        default=None,
        max_length=255,
    )

    description: str | None = None
    is_active: bool | None = None


class MaterialRead(MaterialBase):
    model_config = ConfigDict(
        from_attributes=True,
    )

    id: int
    created_at: datetime
    updated_at: datetime