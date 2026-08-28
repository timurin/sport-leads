from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class ProductModelMaterialLineWrite(BaseModel):
    kind: str = Field(min_length=1, max_length=32)
    nomenclature_id: int = Field(gt=0)
    planned_qty: Decimal = Field(gt=0, max_digits=14, decimal_places=3)
    sequence: int = Field(default=0, ge=0)
    fabric_stage_code: str | None = None
    type_option_id: int | None = Field(default=None, gt=0)
    color_option_id: int | None = Field(default=None, gt=0)
    detailing_item_ids: list[int] = Field(default_factory=list)
    # Create-on-miss names for fabric detailing (resolved in service).
    detailing_names: list[str] = Field(default_factory=list)

    @field_validator("kind", "fabric_stage_code", mode="before")
    @classmethod
    def strip_str(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value

    @field_validator("detailing_names", mode="before")
    @classmethod
    def normalize_names(cls, value: object) -> object:
        if not isinstance(value, list):
            return value
        out: list[str] = []
        for item in value:
            if isinstance(item, str) and item.strip():
                out.append(item.strip())
        return out

    @model_validator(mode="after")
    def validate_kind_rules(self) -> "ProductModelMaterialLineWrite":
        kind = self.kind
        allowed = {"print", "fabric", "cutting", "hardware", "packaging"}
        if kind not in allowed:
            raise ValueError(f"Недопустимый kind: {kind}")
        if kind == "fabric":
            if self.fabric_stage_code not in {"print", "cutting"}:
                raise ValueError("Для ткани укажите цех: print или cutting")
        elif self.fabric_stage_code is not None:
            raise ValueError("fabric_stage_code только для kind=fabric")
        if kind != "hardware":
            if self.type_option_id is not None or self.color_option_id is not None:
                raise ValueError("Тип/цвет только для фурнитуры")
        if kind != "fabric" and (
            self.detailing_item_ids or self.detailing_names
        ):
            raise ValueError("Деталировка только для ткани")
        return self


class ProductModelMaterialLinesReplace(BaseModel):
    lines: list[ProductModelMaterialLineWrite] = Field(default_factory=list)


class DetailingItemEmbed(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str


class ProductModelMaterialLineRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    product_model_id: int
    kind: str
    nomenclature_id: int
    nomenclature_name: str | None = None
    nomenclature_unit: str | None = None
    planned_qty: Decimal
    sequence: int
    fabric_stage_code: str | None = None
    type_option_id: int | None = None
    type_option_label: str | None = None
    color_option_id: int | None = None
    color_option_label: str | None = None
    detailing_items: list[DetailingItemEmbed] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime
