from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from enum import Enum
from typing import TYPE_CHECKING

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
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
    from app.models.product_type import ProductType
    from app.models.size_grid import SizeGrid


class ProductModelSizeType(str, Enum):
    MEN = "men"
    WOMEN = "women"
    KIDS = "kids"


class ProductModelStatus(str, Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    ARCHIVED = "archived"


class ProductModelVersionState(str, Enum):
    DRAFT = "draft"
    PUBLISHED = "published"
    ARCHIVED = "archived"


class ProductModelFolder(Base):
    """Navigation folder for product-models catalog (6.1.18). Not a snapshot target."""

    __tablename__ = "product_model_folders"
    __table_args__ = (
        CheckConstraint(
            "sort_order >= 0",
            name="ck_product_model_folders_sort_order_nonnegative",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    parent_id: Mapped[int | None] = mapped_column(
        ForeignKey("product_model_folders.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    default_sewing_operation_template_id: Mapped[int | None] = mapped_column(
        ForeignKey("sewing_operation_templates.id", ondelete="SET NULL"),
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

    parent: Mapped[ProductModelFolder | None] = relationship(
        remote_side="ProductModelFolder.id",
        back_populates="children",
    )
    children: Mapped[list[ProductModelFolder]] = relationship(
        back_populates="parent",
    )
    product_models: Mapped[list[ProductModel]] = relationship(
        back_populates="folder",
    )


class ProductModel(Base):
    """Flat product-model catalog (ADR-014 / product-model-domain.md).

    Size-grid FK: `6.2.7` (`size_grid_id`, same `size_type`). PatternSet withdrawn (`6.3` = sewing ops).
    Folder hierarchy: `6.1.18` (`folder_id`, `sort_order`).
    """

    __tablename__ = "product_models"
    __table_args__ = (
        UniqueConstraint("article", name="uq_product_models_article"),
        CheckConstraint(
            "size_type IN ('men', 'women', 'kids')",
            name="ck_product_models_size_type",
        ),
        CheckConstraint(
            "status IN ('draft', 'active', 'archived')",
            name="ck_product_models_status",
        ),
        CheckConstraint(
            "sort_order >= 0",
            name="ck_product_models_sort_order_nonnegative",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    article: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    size_type: Mapped[ProductModelSizeType] = mapped_column(String(20), nullable=False, index=True)
    size_grid_id: Mapped[int | None] = mapped_column(
        ForeignKey("size_grids.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    patterns_path: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    product_type_id: Mapped[int | None] = mapped_column(
        ForeignKey("product_types.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    default_routing_template_id: Mapped[int | None] = mapped_column(
        ForeignKey("shop_routing_templates.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    constructor_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    patterns_created_on: Mapped[date | None] = mapped_column(Date, nullable=True)
    cover_image_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    cover_storage_key: Mapped[str | None] = mapped_column(String(500), nullable=True)
    cover_mime_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    folder_id: Mapped[int | None] = mapped_column(
        ForeignKey("product_model_folders.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    status: Mapped[ProductModelStatus] = mapped_column(
        String(20),
        nullable=False,
        default=ProductModelStatus.DRAFT,
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

    folder: Mapped[ProductModelFolder | None] = relationship(
        back_populates="product_models",
    )
    size_grid: Mapped[SizeGrid | None] = relationship("SizeGrid")
    product_type: Mapped[ProductType | None] = relationship("ProductType")
    versions: Mapped[list[ProductModelVersion]] = relationship(
        back_populates="product_model",
        cascade="all, delete-orphan",
        order_by="ProductModelVersion.version_number",
    )
    media_items: Mapped[list[ProductModelMedia]] = relationship(
        back_populates="product_model",
        cascade="all, delete-orphan",
        order_by="ProductModelMedia.sort_order, ProductModelMedia.id",
    )
    history_entries: Mapped[list[ProductModelHistoryEntry]] = relationship(
        back_populates="product_model",
        cascade="all, delete-orphan",
        order_by="ProductModelHistoryEntry.created_at.desc(), ProductModelHistoryEntry.id.desc()",
    )
    assembly_variants: Mapped[list[AssemblyVariant]] = relationship(
        back_populates="product_model",
        cascade="all, delete-orphan",
        order_by="AssemblyVariant.sort_order, AssemblyVariant.id",
    )
    routing_links: Mapped[list[ProductModelRoutingLink]] = relationship(
        back_populates="product_model",
        cascade="all, delete-orphan",
        order_by="ProductModelRoutingLink.sort_order, ProductModelRoutingLink.id",
    )


class ProductModelVersion(Base):
    """PT-08 version history for a product model (`6.1.6`).

    Catalog `ProductModel.status` remains separate from version `state`.
    At most one `published` version per model (enforced in service).
    """

    __tablename__ = "product_model_versions"
    __table_args__ = (
        UniqueConstraint(
            "product_model_id",
            "version_number",
            name="uq_product_model_versions_model_number",
        ),
        CheckConstraint(
            "state IN ('draft', 'published', 'archived')",
            name="ck_product_model_versions_state",
        ),
        CheckConstraint(
            "version_number >= 1",
            name="ck_product_model_versions_number",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    product_model_id: Mapped[int] = mapped_column(
        ForeignKey("product_models.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    version_number: Mapped[int] = mapped_column(Integer, nullable=False)
    label: Mapped[str | None] = mapped_column(String(100), nullable=True)
    state: Mapped[ProductModelVersionState] = mapped_column(
        String(20),
        nullable=False,
        default=ProductModelVersionState.DRAFT,
        index=True,
    )
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
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

    product_model: Mapped[ProductModel] = relationship(back_populates="versions")


class ProductModelMedia(Base):
    """Image gallery for a product model (list thumbnail = is_primary)."""

    __tablename__ = "product_model_media"
    __table_args__ = (
        UniqueConstraint("storage_key", name="uq_product_model_media_storage_key"),
        CheckConstraint("file_size > 0", name="ck_product_model_media_file_size"),
        CheckConstraint("sort_order >= 0", name="ck_product_model_media_sort_order"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    product_model_id: Mapped[int] = mapped_column(
        ForeignKey("product_models.id", ondelete="CASCADE"),
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

    product_model: Mapped[ProductModel] = relationship(back_populates="media_items")


class ProductModelHistoryEntry(Base):
    """Per-model change log (who / what / when), capped at 10 rows FIFO."""

    __tablename__ = "product_model_history"
    HISTORY_LIMIT = 10

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    product_model_id: Mapped[int] = mapped_column(
        ForeignKey("product_models.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    actor: Mapped[str] = mapped_column(String(255), nullable=False, default="Система")
    action: Mapped[str] = mapped_column(String(500), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        index=True,
    )

    product_model: Mapped[ProductModel] = relationship(back_populates="history_entries")


class NomenclatureProductModel(Base):
    """PRODUCT nomenclature ↔ product-model whitelist (ADR-014 §3 / `6.1.11`)."""

    __tablename__ = "nomenclature_product_models"
    __table_args__ = (
        UniqueConstraint(
            "nomenclature_id",
            "product_model_id",
            name="uq_nomenclature_product_models_pair",
        ),
        CheckConstraint(
            "sort_order >= 0",
            name="ck_nomenclature_product_models_sort_order",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    nomenclature_id: Mapped[int] = mapped_column(
        ForeignKey("nomenclatures.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    product_model_id: Mapped[int] = mapped_column(
        ForeignKey("product_models.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
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


class AssemblyVariant(Base):
    """Manager-facing assembly/finishing package on a product model (ADR-014 / `6.1.12`).

    Total cost is always Σ (line.cost * line.quantity_per_item) (computed, not stored).
    Stage 8 shop routings are a separate contour.
    """

    __tablename__ = "assembly_variants"
    __table_args__ = (
        UniqueConstraint(
            "product_model_id",
            "name",
            name="uq_assembly_variants_model_name",
        ),
        CheckConstraint(
            "sort_order >= 0",
            name="ck_assembly_variants_sort_order",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    product_model_id: Mapped[int] = mapped_column(
        ForeignKey("product_models.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, index=True)
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

    product_model: Mapped[ProductModel] = relationship(back_populates="assembly_variants")
    operation_lines: Mapped[list[AssemblyOperationLine]] = relationship(
        back_populates="assembly_variant",
        cascade="all, delete-orphan",
        order_by="AssemblyOperationLine.sequence, AssemblyOperationLine.id",
    )


class AssemblyOperationLine(Base):
    """Ordered operation row inside an assembly variant.

    Copy-on-pick from `SewingOperation`: snapshot `operation_name` + optional
    `sewing_operation_id`; economics default cost=0, qty=1, duration=0 (`26.10`).
    """

    __tablename__ = "assembly_operation_lines"
    __table_args__ = (
        UniqueConstraint(
            "assembly_variant_id",
            "sequence",
            name="uq_assembly_operation_lines_variant_sequence",
        ),
        CheckConstraint(
            "sequence >= 1",
            name="ck_assembly_operation_lines_sequence",
        ),
        CheckConstraint(
            "cost >= 0",
            name="ck_assembly_operation_lines_cost",
        ),
        CheckConstraint(
            "quantity_per_item >= 1",
            name="ck_assembly_operation_lines_quantity_per_item",
        ),
        CheckConstraint(
            "duration_seconds >= 0",
            name="ck_assembly_operation_lines_duration_seconds",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    assembly_variant_id: Mapped[int] = mapped_column(
        ForeignKey("assembly_variants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    sequence: Mapped[int] = mapped_column(Integer, nullable=False)
    operation_name: Mapped[str] = mapped_column(String(255), nullable=False)
    cost: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False, default=Decimal("0"))
    quantity_per_item: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    duration_seconds: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    sewing_operation_id: Mapped[int | None] = mapped_column(
        ForeignKey("sewing_operations.id", ondelete="SET NULL"),
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

    assembly_variant: Mapped[AssemblyVariant] = relationship(back_populates="operation_lines")


class ProductModelRoutingLink(Base):
    """Ordered whitelist: ProductModel ↔ existing ShopRoutingTemplate (`6.1.17`).

    Does not clone routing stage lines — Stage 8 remains master of sequences.
    """

    __tablename__ = "product_model_routing_links"
    __table_args__ = (
        UniqueConstraint(
            "product_model_id",
            "shop_routing_template_id",
            name="uq_product_model_routing_links_model_template",
        ),
        CheckConstraint(
            "sort_order >= 0",
            name="ck_product_model_routing_links_sort_order",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    product_model_id: Mapped[int] = mapped_column(
        ForeignKey("product_models.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    shop_routing_template_id: Mapped[int] = mapped_column(
        ForeignKey("shop_routing_templates.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, index=True)
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

    product_model: Mapped[ProductModel] = relationship(back_populates="routing_links")
    operation_norms: Mapped[list[ProductModelOperationNorm]] = relationship(
        back_populates="routing_link",
        cascade="all, delete-orphan",
        order_by="ProductModelOperationNorm.id",
    )


class ProductModelOperationNorm(Base):
    """Plan-hint material/op norm on a model routing whitelist link (`6.1.17`).

    `norm_qty_per_item` is for 1 finished unit — not fact qty and not hard BOM×order-qty.
    Uniqueness: one row per (link, production_stage_id, tech_operation_id) with
    partial unique indexes when tech_operation_id is null vs set.
    """

    __tablename__ = "product_model_operation_norms"
    __table_args__ = (
        CheckConstraint(
            "norm_qty_per_item >= 0",
            name="ck_product_model_operation_norms_qty_nonnegative",
        ),
        CheckConstraint(
            "production_stage_id IS NOT NULL OR tech_operation_id IS NOT NULL",
            name="ck_product_model_operation_norms_stage_or_op",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    product_model_routing_link_id: Mapped[int] = mapped_column(
        ForeignKey("product_model_routing_links.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    production_stage_id: Mapped[int | None] = mapped_column(
        ForeignKey("production_stages.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    tech_operation_id: Mapped[int | None] = mapped_column(
        ForeignKey("tech_operations.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    norm_qty_per_item: Mapped[Decimal] = mapped_column(
        Numeric(14, 3),
        nullable=False,
        default=Decimal("0"),
    )
    unit: Mapped[str] = mapped_column(String(64), nullable=False)
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

    routing_link: Mapped[ProductModelRoutingLink] = relationship(
        back_populates="operation_norms"
    )
