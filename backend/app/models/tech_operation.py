"""Shop-floor TechOperation catalog (ADR-017 / Stage 8.1.3 / amend 8.3).

Distinct from Stage 6 SewingOperation (name + cost). Belongs to a ProductionStage.
"""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base
from app.models.technical_card import TechOperationVolumeUnit


class TechOperation(Base):
    """Shop tech-operation with volume unit; belongs to a production stage (цех)."""

    __tablename__ = "tech_operations"
    __table_args__ = (
        UniqueConstraint("name", name="uq_tech_operations_name"),
        UniqueConstraint("code", name="uq_tech_operations_code"),
        CheckConstraint(
            "volume_unit IN ('linear_meters', 'pieces')",
            name="ck_tech_operations_volume_unit",
        ),
        CheckConstraint(
            "sort_order >= 0",
            name="ck_tech_operations_sort_order_nonnegative",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    code: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    volume_unit: Mapped[TechOperationVolumeUnit] = mapped_column(
        String(20),
        nullable=False,
    )
    production_stage_id: Mapped[int | None] = mapped_column(
        ForeignKey("production_stages.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, index=True
    )
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
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

    production_stage = relationship("ProductionStage")
    required_materials: Mapped[list["TechOperationRequiredMaterial"]] = relationship(
        back_populates="tech_operation",
        cascade="all, delete-orphan",
        order_by="TechOperationRequiredMaterial.id",
    )


class TechOperationRequiredMaterial(Base):
    """Default MATERIAL consumption per one TechOperation volume unit."""

    __tablename__ = "tech_operation_required_materials"
    __table_args__ = (
        CheckConstraint(
            "quantity >= 0",
            name="ck_tech_operation_required_materials_quantity_nonnegative",
        ),
        UniqueConstraint(
            "tech_operation_id",
            "nomenclature_id",
            name="uq_tech_operation_required_materials_pair",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    tech_operation_id: Mapped[int] = mapped_column(
        ForeignKey("tech_operations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    nomenclature_id: Mapped[int] = mapped_column(
        ForeignKey("nomenclatures.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    quantity: Mapped[Decimal] = mapped_column(
        Numeric(14, 3), nullable=False, default=Decimal("0")
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

    tech_operation: Mapped[TechOperation] = relationship(back_populates="required_materials")
    nomenclature = relationship("Nomenclature")
