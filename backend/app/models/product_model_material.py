from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from enum import StrEnum

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Table,
    Column,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base


class ProductModelMaterialKind(StrEnum):
    PRINT = "print"
    FABRIC = "fabric"
    CUTTING = "cutting"
    HARDWARE = "hardware"
    PACKAGING = "packaging"


product_model_material_line_detailings = Table(
    "product_model_material_line_detailings",
    Base.metadata,
    Column(
        "material_line_id",
        Integer,
        ForeignKey("product_model_material_lines.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "detailing_item_id",
        Integer,
        ForeignKey("detailing_items.id", ondelete="RESTRICT"),
        primary_key=True,
    ),
)


class ProductModelMaterialLine(Base):
    """Model Materials BOM line (Stage 26.13 / ADR-035)."""

    __tablename__ = "product_model_material_lines"
    __table_args__ = (
        CheckConstraint(
            "kind IN ('print', 'fabric', 'cutting', 'hardware', 'packaging')",
            name="ck_product_model_material_lines_kind",
        ),
        CheckConstraint(
            "planned_qty > 0",
            name="ck_product_model_material_lines_planned_qty_positive",
        ),
        CheckConstraint(
            "sequence >= 0",
            name="ck_product_model_material_lines_sequence_nonnegative",
        ),
        CheckConstraint(
            "(kind <> 'fabric' AND fabric_stage_code IS NULL) OR "
            "(kind = 'fabric' AND fabric_stage_code IN ('print', 'cutting'))",
            name="ck_product_model_material_lines_fabric_stage",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    product_model_id: Mapped[int] = mapped_column(
        ForeignKey("product_models.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    kind: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    nomenclature_id: Mapped[int] = mapped_column(
        ForeignKey("nomenclatures.id", ondelete="RESTRICT"),
        nullable=False,
    )
    planned_qty: Mapped[Decimal] = mapped_column(Numeric(14, 3), nullable=False)
    sequence: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    fabric_stage_code: Mapped[str | None] = mapped_column(String(32), nullable=True)
    type_option_id: Mapped[int | None] = mapped_column(
        ForeignKey("characteristic_options.id", ondelete="SET NULL"),
        nullable=True,
    )
    color_option_id: Mapped[int | None] = mapped_column(
        ForeignKey("characteristic_options.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    nomenclature = relationship("Nomenclature", lazy="joined")
    type_option = relationship(
        "CharacteristicOption",
        foreign_keys=[type_option_id],
        lazy="joined",
    )
    color_option = relationship(
        "CharacteristicOption",
        foreign_keys=[color_option_id],
        lazy="joined",
    )
    detailing_items = relationship(
        "DetailingItem",
        secondary=product_model_material_line_detailings,
        lazy="selectin",
    )
