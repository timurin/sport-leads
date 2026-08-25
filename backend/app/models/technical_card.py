"""Technical card persistence (ADR-016 / Stage 9.1.2).

Soft refs without FK:
- `routing_template_id` → Stage 8 template id snapshot (no live FK; name copied)
- `tech_operation_id` on operation lines → Stage `8.1.3` TechOperation
  (ORM catalog exists; card keeps soft integer + snapshot fields)

`specification_version_id` is a real FK to `specification_versions` (ADR-031 / 7.1.2).
"""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from enum import Enum
from typing import TYPE_CHECKING

from sqlalchemy import (
    Boolean,
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
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base

if TYPE_CHECKING:
    from app.models.sales import SalesOrder, SalesOrderItem
    from app.models.specification import SpecificationVersion


class TechnicalCardStatus(str, Enum):
    """Provisional lifecycle for persistence; full state machine in `9.2.2`."""

    DRAFT = "draft"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class TechOperationVolumeUnit(str, Enum):
    """Volume unit snapshot from TechOperation catalog (`8.1.3`)."""

    LINEAR_METERS = "linear_meters"
    PIECES = "pieces"


class TechnicalCardCompositionLineKind(str, Enum):
    MATERIAL = "material"
    PATTERN = "pattern"
    NOTE = "note"


class TechnicalCardStageResultStatus(str, Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    SKIPPED = "skipped"


class TechnicalCardOperationLineSourceKind(str, Enum):
    """Origin of an op-volume row: shop routing TechOperation vs sewing snapshot."""

    ROUTING = "routing"
    SEWING = "sewing"


class TechnicalCard(Base):
    """One production document per manufacturable `SalesOrderItem` (ADR-016 §1)."""

    __tablename__ = "technical_cards"
    __table_args__ = (
        UniqueConstraint("sales_order_item_id", name="uq_technical_cards_sales_order_item_id"),
        UniqueConstraint("sales_order_id", "card_seq", name="uq_technical_cards_order_card_seq"),
        UniqueConstraint("number", name="uq_technical_cards_number"),
        UniqueConstraint("qr_token", name="uq_technical_cards_qr_token"),
        CheckConstraint("card_seq >= 1", name="ck_technical_cards_card_seq"),
        CheckConstraint(
            "status IN ('draft', 'in_progress', 'completed', 'cancelled')",
            name="ck_technical_cards_status",
        ),
        CheckConstraint(
            "quantity > 0",
            name="ck_technical_cards_quantity_positive",
        ),
        CheckConstraint(
            "product_model_size_type IS NULL OR product_model_size_type IN ('men', 'women', 'kids')",
            name="ck_technical_cards_product_model_size_type",
        ),
        CheckConstraint(
            "assembly_variant_total_cost IS NULL OR assembly_variant_total_cost >= 0",
            name="ck_technical_cards_assembly_variant_total_cost",
        ),
        CheckConstraint(
            "current_stage_order IS NULL OR current_stage_order >= 1",
            name="ck_technical_cards_current_stage_order",
        ),
        Index("ix_technical_cards_sales_order_id", "sales_order_id"),
        Index("ix_technical_cards_status", "status"),
        Index("ix_technical_cards_updated_at", "updated_at"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    sales_order_id: Mapped[int] = mapped_column(
        ForeignKey("sales_orders.id", ondelete="RESTRICT"),
        nullable=False,
    )
    sales_order_item_id: Mapped[int] = mapped_column(
        ForeignKey("sales_order_items.id", ondelete="RESTRICT"),
        nullable=False,
    )
    number: Mapped[str] = mapped_column(String(80), nullable=False)
    qr_token: Mapped[str | None] = mapped_column(String(64), nullable=True)
    card_seq: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[TechnicalCardStatus] = mapped_column(
        String(20),
        nullable=False,
        default=TechnicalCardStatus.DRAFT,
    )
    quantity: Mapped[Decimal] = mapped_column(Numeric(14, 3), nullable=False)

    nomenclature_id: Mapped[int | None] = mapped_column(
        ForeignKey("nomenclatures.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    nomenclature_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    nomenclature_type: Mapped[str | None] = mapped_column(String(30), nullable=True)

    product_model_id: Mapped[int | None] = mapped_column(
        ForeignKey("product_models.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    product_model_article: Mapped[str | None] = mapped_column(String(100), nullable=True)
    product_model_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    product_model_size_type: Mapped[str | None] = mapped_column(String(20), nullable=True)

    assembly_variant_id: Mapped[int | None] = mapped_column(
        ForeignKey("assembly_variants.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    assembly_variant_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    assembly_variant_total_cost: Mapped[Decimal | None] = mapped_column(
        Numeric(14, 2), nullable=True
    )

    # Stamp after Spec approve (ADR-031); not a generate gate.
    specification_version_id: Mapped[int | None] = mapped_column(
        ForeignKey("specification_versions.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    specification_version_label: Mapped[str | None] = mapped_column(String(255), nullable=True)
    routing_template_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    routing_template_name: Mapped[str | None] = mapped_column(String(255), nullable=True)

    current_stage_order: Mapped[int | None] = mapped_column(Integer, nullable=True)
    current_stage_label: Mapped[str | None] = mapped_column(String(255), nullable=True)

    design_mockup_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
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

    order: Mapped[SalesOrder] = relationship()
    order_item: Mapped[SalesOrderItem] = relationship()
    specification_version: Mapped[SpecificationVersion | None] = relationship(
        "SpecificationVersion",
        foreign_keys="TechnicalCard.specification_version_id",
    )
    composition_lines: Mapped[list[TechnicalCardCompositionLine]] = relationship(
        back_populates="technical_card",
        cascade="all, delete-orphan",
        order_by="TechnicalCardCompositionLine.sequence, TechnicalCardCompositionLine.id",
    )
    unit_lines: Mapped[list[TechnicalCardUnitLine]] = relationship(
        back_populates="technical_card",
        cascade="all, delete-orphan",
        order_by="TechnicalCardUnitLine.unit_index, TechnicalCardUnitLine.id",
    )
    operation_lines: Mapped[list[TechnicalCardOperationLine]] = relationship(
        back_populates="technical_card",
        cascade="all, delete-orphan",
        order_by="TechnicalCardOperationLine.sequence, TechnicalCardOperationLine.id",
    )
    stage_results: Mapped[list[TechnicalCardStageResult]] = relationship(
        back_populates="technical_card",
        cascade="all, delete-orphan",
        order_by="TechnicalCardStageResult.stage_order, TechnicalCardStageResult.id",
    )
    media_items: Mapped[list["TechnicalCardMedia"]] = relationship(
        back_populates="technical_card",
        cascade="all, delete-orphan",
        order_by="TechnicalCardMedia.sort_order, TechnicalCardMedia.id",
    )


class TechnicalCardCompositionLine(Base):
    """Planned composition / material / pattern snapshot rows on the card."""

    __tablename__ = "technical_card_composition_lines"
    __table_args__ = (
        UniqueConstraint(
            "technical_card_id",
            "sequence",
            name="uq_technical_card_composition_lines_card_sequence",
        ),
        CheckConstraint("sequence >= 1", name="ck_technical_card_composition_lines_sequence"),
        CheckConstraint(
            "line_kind IN ('material', 'pattern', 'note')",
            name="ck_technical_card_composition_lines_line_kind",
        ),
        CheckConstraint(
            "planned_qty IS NULL OR planned_qty >= 0",
            name="ck_technical_card_composition_lines_planned_qty",
        ),
        CheckConstraint(
            "fact_qty IS NULL OR fact_qty >= 0",
            name="ck_technical_card_composition_lines_fact_qty",
        ),
        Index("ix_technical_card_composition_lines_card_id", "technical_card_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    technical_card_id: Mapped[int] = mapped_column(
        ForeignKey("technical_cards.id", ondelete="CASCADE"),
        nullable=False,
    )
    sequence: Mapped[int] = mapped_column(Integer, nullable=False)
    line_kind: Mapped[TechnicalCardCompositionLineKind] = mapped_column(
        String(20),
        nullable=False,
        default=TechnicalCardCompositionLineKind.MATERIAL,
    )
    nomenclature_id: Mapped[int | None] = mapped_column(
        ForeignKey("nomenclatures.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    snapshot_name: Mapped[str] = mapped_column(String(255), nullable=False)
    planned_qty: Mapped[Decimal | None] = mapped_column(Numeric(14, 3), nullable=True)
    fact_qty: Mapped[Decimal | None] = mapped_column(Numeric(14, 3), nullable=True)
    production_stage_id: Mapped[int | None] = mapped_column(
        ForeignKey("production_stages.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    unit: Mapped[str | None] = mapped_column(String(30), nullable=True)
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

    technical_card: Mapped[TechnicalCard] = relationship(back_populates="composition_lines")


class TechnicalCardUnitLine(Base):
    """Per-piece characteristic row; N rows = order-line quantity (ADR-016 §2)."""

    __tablename__ = "technical_card_unit_lines"
    __table_args__ = (
        UniqueConstraint(
            "technical_card_id",
            "unit_index",
            name="uq_technical_card_unit_lines_card_unit_index",
        ),
        CheckConstraint("unit_index >= 1", name="ck_technical_card_unit_lines_unit_index"),
        CheckConstraint(
            "size_type IS NULL OR size_type IN ('male', 'female')",
            name="ck_technical_card_unit_lines_size_type",
        ),
        CheckConstraint(
            "last_transfer_kind IS NULL OR last_transfer_kind IN "
            "('accept', 'forward', 'return')",
            name="ck_technical_card_unit_lines_last_transfer_kind",
        ),
        Index("ix_technical_card_unit_lines_card_id", "technical_card_id"),
        Index(
            "ix_technical_card_unit_lines_production_stage_id",
            "production_stage_id",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    technical_card_id: Mapped[int] = mapped_column(
        ForeignKey("technical_cards.id", ondelete="CASCADE"),
        nullable=False,
    )
    unit_index: Mapped[int] = mapped_column(Integer, nullable=False)
    size_type: Mapped[str | None] = mapped_column(String(20), nullable=True)
    size: Mapped[str | None] = mapped_column(String(100), nullable=True)
    personalization: Mapped[str | None] = mapped_column(String(500), nullable=True)
    print_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
    color: Mapped[str | None] = mapped_column(String(100), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    production_stage_id: Mapped[int | None] = mapped_column(
        ForeignKey("production_stages.id", ondelete="SET NULL"),
        nullable=True,
    )
    last_transfer_kind: Mapped[str | None] = mapped_column(String(20), nullable=True)
    fg_receipt_posted: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    fg_issue_posted: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    is_scrapped: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
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

    technical_card: Mapped[TechnicalCard] = relationship(back_populates="unit_lines")


class TechnicalCardOperationLine(Base):
    """TechOperation / sewing volume row snapshot on the card (ADR-016 §3 / `9.3.3`).

    `tech_operation_id` is a soft integer (catalog Stage 8.1.3).
    `source_kind` distinguishes routing TechOperations from sewing assembly snapshots.
    """

    __tablename__ = "technical_card_operation_lines"
    __table_args__ = (
        UniqueConstraint(
            "technical_card_id",
            "sequence",
            name="uq_technical_card_operation_lines_card_sequence",
        ),
        CheckConstraint("sequence >= 1", name="ck_technical_card_operation_lines_sequence"),
        CheckConstraint(
            "volume_unit IN ('linear_meters', 'pieces')",
            name="ck_technical_card_operation_lines_volume_unit",
        ),
        CheckConstraint(
            "volume >= 0",
            name="ck_technical_card_operation_lines_volume",
        ),
        CheckConstraint(
            "stage_order IS NULL OR stage_order >= 1",
            name="ck_technical_card_operation_lines_stage_order",
        ),
        CheckConstraint(
            "source_kind IN ('routing', 'sewing')",
            name="ck_technical_card_operation_lines_source_kind",
        ),
        Index("ix_technical_card_operation_lines_card_id", "technical_card_id"),
        Index("ix_technical_card_operation_lines_tech_operation_id", "tech_operation_id"),
        Index("ix_technical_card_operation_lines_sewing_operation_id", "sewing_operation_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    technical_card_id: Mapped[int] = mapped_column(
        ForeignKey("technical_cards.id", ondelete="CASCADE"),
        nullable=False,
    )
    sequence: Mapped[int] = mapped_column(Integer, nullable=False)
    source_kind: Mapped[TechnicalCardOperationLineSourceKind] = mapped_column(
        String(20),
        nullable=False,
        default=TechnicalCardOperationLineSourceKind.ROUTING,
    )
    # Soft ref → Stage 8.1.3 TechOperation.
    tech_operation_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    sewing_operation_id: Mapped[int | None] = mapped_column(
        ForeignKey("sewing_operations.id", ondelete="SET NULL"),
        nullable=True,
    )
    operation_name: Mapped[str] = mapped_column(String(255), nullable=False)
    volume_unit: Mapped[TechOperationVolumeUnit] = mapped_column(String(20), nullable=False)
    volume: Mapped[Decimal] = mapped_column(
        Numeric(14, 3), nullable=False, default=Decimal("0")
    )
    stage_order: Mapped[int | None] = mapped_column(Integer, nullable=True)
    production_stage_id: Mapped[int | None] = mapped_column(
        ForeignKey("production_stages.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
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

    technical_card: Mapped[TechnicalCard] = relationship(back_populates="operation_lines")


class TechnicalCardMedia(Base):
    """Design mockup gallery for a technical card (max 3 enforced in service)."""

    __tablename__ = "technical_card_media"
    __table_args__ = (
        UniqueConstraint("storage_key", name="uq_technical_card_media_storage_key"),
        CheckConstraint("file_size > 0", name="ck_technical_card_media_file_size"),
        CheckConstraint("sort_order >= 0", name="ck_technical_card_media_sort_order"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    technical_card_id: Mapped[int] = mapped_column(
        ForeignKey("technical_cards.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    storage_key: Mapped[str] = mapped_column(String(500), nullable=False)
    mime_type: Mapped[str] = mapped_column(String(100), nullable=False)
    file_size: Mapped[int] = mapped_column(Integer, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_primary: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, index=True)
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

    technical_card: Mapped[TechnicalCard] = relationship(back_populates="media_items")


class TechnicalCardStageResult(Base):
    """Fact of stage passage on the card (gates enforced in `9.2.2`)."""

    __tablename__ = "technical_card_stage_results"
    __table_args__ = (
        UniqueConstraint(
            "technical_card_id",
            "stage_order",
            name="uq_technical_card_stage_results_card_stage_order",
        ),
        CheckConstraint("stage_order >= 1", name="ck_technical_card_stage_results_stage_order"),
        CheckConstraint(
            "status IN ('pending', 'in_progress', 'completed', 'skipped')",
            name="ck_technical_card_stage_results_status",
        ),
        CheckConstraint(
            "scrap_qty IS NULL OR scrap_qty >= 0",
            name="ck_technical_card_stage_results_scrap_qty",
        ),
        CheckConstraint(
            "rework_qty IS NULL OR rework_qty >= 0",
            name="ck_technical_card_stage_results_rework_qty",
        ),
        CheckConstraint(
            "duration_seconds IS NULL OR duration_seconds >= 0",
            name="ck_technical_card_stage_results_duration_seconds",
        ),
        Index("ix_technical_card_stage_results_card_id", "technical_card_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    technical_card_id: Mapped[int] = mapped_column(
        ForeignKey("technical_cards.id", ondelete="CASCADE"),
        nullable=False,
    )
    stage_order: Mapped[int] = mapped_column(Integer, nullable=False)
    production_stage_id: Mapped[int | None] = mapped_column(
        ForeignKey("production_stages.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    stage_label: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[TechnicalCardStageResultStatus] = mapped_column(
        String(20),
        nullable=False,
        default=TechnicalCardStageResultStatus.PENDING,
    )
    performer_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    scrap_qty: Mapped[Decimal | None] = mapped_column(Numeric(14, 3), nullable=True)
    rework_qty: Mapped[Decimal | None] = mapped_column(Numeric(14, 3), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    work_done: Mapped[str | None] = mapped_column(Text, nullable=True)
    duration_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
    work_center_id: Mapped[int | None] = mapped_column(
        ForeignKey("work_centers.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
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

    technical_card: Mapped[TechnicalCard] = relationship(back_populates="stage_results")
