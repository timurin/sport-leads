from __future__ import annotations

from datetime import datetime
from enum import Enum

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base


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


class ProductModel(Base):
    """Flat product-model catalog (ADR-014 / product-model-domain.md).

    Size-grid / pattern-set FKs land in `6.2.7` / `6.3.7`.
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
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    article: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    size_type: Mapped[ProductModelSizeType] = mapped_column(String(20), nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    cover_image_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    cover_storage_key: Mapped[str | None] = mapped_column(String(500), nullable=True)
    cover_mime_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
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
