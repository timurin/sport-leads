"""Specification plan+fact report document (ADR-031 / Stage 7.1.2).

Parent is ProductionBatch 1:1. Not a start gate for batch/TC. Lines belong to
a version; refresh/approve live in services (`7.2`), not here.
"""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from enum import Enum
from typing import TYPE_CHECKING

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base

if TYPE_CHECKING:
    from app.models.production_order import ProductionBatch, ProductionOrder
    from app.models.sales import SalesOrder, SalesOrderItem
    from app.models.technical_card import TechnicalCard


class SpecificationVersionStatus(str, Enum):
    DRAFT = "draft"
    APPROVED = "approved"
    SUPERSEDED = "superseded"
    CANCELLED = "cancelled"


class SpecificationOperationSourceKind(str, Enum):
    ROUTING = "routing"
    SEWING = "sewing"


class Specification(Base):
    """Header: one document per production batch (ADR-031)."""

    __tablename__ = "specifications"
    __table_args__ = (
        UniqueConstraint(
            "production_batch_id",
            name="uq_specifications_production_batch_id",
        ),
        UniqueConstraint("number", name="uq_specifications_number"),
        Index("ix_specifications_sales_order_id", "sales_order_id"),
        Index("ix_specifications_production_order_id", "production_order_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    production_batch_id: Mapped[int] = mapped_column(
        ForeignKey("production_batches.id", ondelete="CASCADE"),
        nullable=False,
    )
    number: Mapped[str] = mapped_column(String(120), nullable=False)
    sales_order_id: Mapped[int | None] = mapped_column(
        ForeignKey("sales_orders.id", ondelete="RESTRICT"),
        nullable=True,
    )
    production_order_id: Mapped[int] = mapped_column(
        ForeignKey("production_orders.id", ondelete="RESTRICT"),
        nullable=False,
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
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

    batch: Mapped[ProductionBatch] = relationship(
        "ProductionBatch",
        back_populates="specification",
    )
    sales_order: Mapped[SalesOrder | None] = relationship("SalesOrder")
    production_order: Mapped[ProductionOrder] = relationship("ProductionOrder")
    versions: Mapped[list[SpecificationVersion]] = relationship(
        "SpecificationVersion",
        back_populates="specification",
        cascade="all, delete-orphan",
        order_by="SpecificationVersion.version_no",
    )


class SpecificationVersion(Base):
    """One report version; lines hang here (ADR-031 lifecycle)."""

    __tablename__ = "specification_versions"
    __table_args__ = (
        UniqueConstraint(
            "specification_id",
            "version_no",
            name="uq_specification_versions_header_version_no",
        ),
        CheckConstraint("version_no >= 1", name="ck_specification_versions_version_no"),
        CheckConstraint(
            "status IN ('draft', 'approved', 'superseded', 'cancelled')",
            name="ck_specification_versions_status",
        ),
        Index("ix_specification_versions_specification_id", "specification_id"),
        Index("ix_specification_versions_status", "status"),
        Index(
            "uq_specification_versions_one_draft",
            "specification_id",
            unique=True,
            postgresql_where=text("status = 'draft'"),
            sqlite_where=text("status = 'draft'"),
        ),
        Index(
            "uq_specification_versions_one_approved",
            "specification_id",
            unique=True,
            postgresql_where=text("status = 'approved'"),
            sqlite_where=text("status = 'approved'"),
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    specification_id: Mapped[int] = mapped_column(
        ForeignKey("specifications.id", ondelete="CASCADE"),
        nullable=False,
    )
    version_no: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[SpecificationVersionStatus] = mapped_column(
        String(20),
        nullable=False,
        default=SpecificationVersionStatus.DRAFT,
        server_default=SpecificationVersionStatus.DRAFT.value,
    )
    approved_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    cancelled_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
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

    specification: Mapped[Specification] = relationship(
        "Specification",
        back_populates="versions",
    )
    product_lines: Mapped[list[SpecificationProductLine]] = relationship(
        "SpecificationProductLine",
        back_populates="version",
        cascade="all, delete-orphan",
        order_by="SpecificationProductLine.sequence, SpecificationProductLine.id",
    )
    material_lines: Mapped[list[SpecificationMaterialLine]] = relationship(
        "SpecificationMaterialLine",
        back_populates="version",
        cascade="all, delete-orphan",
        order_by="SpecificationMaterialLine.sequence, SpecificationMaterialLine.id",
    )
    operation_lines: Mapped[list[SpecificationOperationLine]] = relationship(
        "SpecificationOperationLine",
        back_populates="version",
        cascade="all, delete-orphan",
        order_by="SpecificationOperationLine.sequence, SpecificationOperationLine.id",
    )


class SpecificationProductLine(Base):
    """Sold product snapshot from a batch-linked technical card."""

    __tablename__ = "specification_product_lines"
    __table_args__ = (
        UniqueConstraint(
            "specification_version_id",
            "sequence",
            name="uq_specification_product_lines_version_sequence",
        ),
        CheckConstraint("sequence >= 1", name="ck_specification_product_lines_sequence"),
        CheckConstraint(
            "quantity > 0",
            name="ck_specification_product_lines_quantity_positive",
        ),
        Index("ix_specification_product_lines_version_id", "specification_version_id"),
        Index("ix_specification_product_lines_technical_card_id", "technical_card_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    specification_version_id: Mapped[int] = mapped_column(
        ForeignKey("specification_versions.id", ondelete="CASCADE"),
        nullable=False,
    )
    sequence: Mapped[int] = mapped_column(Integer, nullable=False)
    technical_card_id: Mapped[int] = mapped_column(
        ForeignKey("technical_cards.id", ondelete="RESTRICT"),
        nullable=False,
    )
    sales_order_item_id: Mapped[int | None] = mapped_column(
        ForeignKey("sales_order_items.id", ondelete="SET NULL"),
        nullable=True,
    )
    nomenclature_id: Mapped[int | None] = mapped_column(
        ForeignKey("nomenclatures.id", ondelete="SET NULL"),
        nullable=True,
    )
    nomenclature_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    nomenclature_type: Mapped[str | None] = mapped_column(String(30), nullable=True)
    product_model_id: Mapped[int | None] = mapped_column(
        ForeignKey("product_models.id", ondelete="SET NULL"),
        nullable=True,
    )
    product_model_article: Mapped[str | None] = mapped_column(String(100), nullable=True)
    product_model_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    assembly_variant_id: Mapped[int | None] = mapped_column(
        ForeignKey("assembly_variants.id", ondelete="SET NULL"),
        nullable=True,
    )
    assembly_variant_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    quantity: Mapped[Decimal] = mapped_column(Numeric(14, 3), nullable=False)

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

    version: Mapped[SpecificationVersion] = relationship(
        "SpecificationVersion",
        back_populates="product_lines",
    )
    technical_card: Mapped[TechnicalCard] = relationship("TechnicalCard")
    sales_order_item: Mapped[SalesOrderItem | None] = relationship("SalesOrderItem")


class SpecificationMaterialLine(Base):
    """Aggregated material plan+fact (TC line_kind=material only; ADR-031 §3)."""

    __tablename__ = "specification_material_lines"
    __table_args__ = (
        UniqueConstraint(
            "specification_version_id",
            "sequence",
            name="uq_specification_material_lines_version_sequence",
        ),
        CheckConstraint("sequence >= 1", name="ck_specification_material_lines_sequence"),
        CheckConstraint(
            "planned_qty IS NULL OR planned_qty >= 0",
            name="ck_specification_material_lines_planned_qty",
        ),
        CheckConstraint(
            "fact_qty IS NULL OR fact_qty >= 0",
            name="ck_specification_material_lines_fact_qty",
        ),
        Index("ix_specification_material_lines_version_id", "specification_version_id"),
        Index("ix_specification_material_lines_nomenclature_id", "nomenclature_id"),
        Index(
            "ix_specification_material_lines_production_stage_id",
            "production_stage_id",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    specification_version_id: Mapped[int] = mapped_column(
        ForeignKey("specification_versions.id", ondelete="CASCADE"),
        nullable=False,
    )
    sequence: Mapped[int] = mapped_column(Integer, nullable=False)
    nomenclature_id: Mapped[int | None] = mapped_column(
        ForeignKey("nomenclatures.id", ondelete="SET NULL"),
        nullable=True,
    )
    snapshot_name: Mapped[str] = mapped_column(String(255), nullable=False)
    unit: Mapped[str | None] = mapped_column(String(30), nullable=True)
    production_stage_id: Mapped[int | None] = mapped_column(
        ForeignKey("production_stages.id", ondelete="SET NULL"),
        nullable=True,
    )
    planned_qty: Mapped[Decimal | None] = mapped_column(Numeric(14, 3), nullable=True)
    fact_qty: Mapped[Decimal | None] = mapped_column(Numeric(14, 3), nullable=True)

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

    version: Mapped[SpecificationVersion] = relationship(
        "SpecificationVersion",
        back_populates="material_lines",
    )


class SpecificationOperationLine(Base):
    """Routing/sewing volume plan+fact snapshot (ADR-031 §4)."""

    __tablename__ = "specification_operation_lines"
    __table_args__ = (
        UniqueConstraint(
            "specification_version_id",
            "sequence",
            name="uq_specification_operation_lines_version_sequence",
        ),
        CheckConstraint(
            "sequence >= 1",
            name="ck_specification_operation_lines_sequence",
        ),
        CheckConstraint(
            "source_kind IN ('routing', 'sewing')",
            name="ck_specification_operation_lines_source_kind",
        ),
        CheckConstraint(
            "volume_unit IN ('linear_meters', 'pieces')",
            name="ck_specification_operation_lines_volume_unit",
        ),
        CheckConstraint(
            "planned_volume >= 0",
            name="ck_specification_operation_lines_planned_volume",
        ),
        CheckConstraint(
            "fact_volume IS NULL OR fact_volume >= 0",
            name="ck_specification_operation_lines_fact_volume",
        ),
        CheckConstraint(
            "duration_seconds IS NULL OR duration_seconds >= 0",
            name="ck_specification_operation_lines_duration_seconds",
        ),
        Index("ix_specification_operation_lines_version_id", "specification_version_id"),
        Index(
            "ix_specification_operation_lines_technical_card_id",
            "technical_card_id",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    specification_version_id: Mapped[int] = mapped_column(
        ForeignKey("specification_versions.id", ondelete="CASCADE"),
        nullable=False,
    )
    sequence: Mapped[int] = mapped_column(Integer, nullable=False)
    source_kind: Mapped[SpecificationOperationSourceKind] = mapped_column(
        String(20),
        nullable=False,
    )
    technical_card_id: Mapped[int | None] = mapped_column(
        ForeignKey("technical_cards.id", ondelete="SET NULL"),
        nullable=True,
    )
    tech_operation_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    sewing_operation_id: Mapped[int | None] = mapped_column(
        ForeignKey("sewing_operations.id", ondelete="SET NULL"),
        nullable=True,
    )
    operation_name: Mapped[str] = mapped_column(String(255), nullable=False)
    volume_unit: Mapped[str] = mapped_column(String(20), nullable=False)
    planned_volume: Mapped[Decimal] = mapped_column(
        Numeric(14, 3),
        nullable=False,
        default=Decimal("0"),
    )
    fact_volume: Mapped[Decimal | None] = mapped_column(Numeric(14, 3), nullable=True)
    duration_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
    performer_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    production_stage_id: Mapped[int | None] = mapped_column(
        ForeignKey("production_stages.id", ondelete="SET NULL"),
        nullable=True,
    )
    stage_label: Mapped[str | None] = mapped_column(String(255), nullable=True)

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

    version: Mapped[SpecificationVersion] = relationship(
        "SpecificationVersion",
        back_populates="operation_lines",
    )
    technical_card: Mapped[TechnicalCard | None] = relationship("TechnicalCard")
