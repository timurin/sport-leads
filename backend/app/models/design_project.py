"""DesignProject + DesignVersion persistence (ADR-021 / Stage 10.1.1.2)."""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base

if TYPE_CHECKING:
    from app.models.sales import SalesOrder, SalesOrderItem
    from app.models.technical_card import TechnicalCard


class DesignProjectStatus(str, Enum):
    DRAFT = "draft"
    IN_PROGRESS = "in_progress"
    READY = "ready"
    ARCHIVED = "archived"


class DesignVersionStatus(str, Enum):
    DRAFT = "draft"
    CURRENT = "current"
    SUPERSEDED = "superseded"


class DesignVersionAssetKind(str, Enum):
    LAYOUT = "layout"
    LOGO = "logo"
    OTHER = "other"


class DesignProject(Base):
    """Design work container for one SalesOrder (ADR-021)."""

    __tablename__ = "design_projects"
    __table_args__ = (
        UniqueConstraint(
            "sales_order_id",
            "project_seq",
            name="uq_design_projects_sales_order_seq",
        ),
        UniqueConstraint("number", name="uq_design_projects_number"),
        Index("ix_design_projects_sales_order_id", "sales_order_id"),
        Index("ix_design_projects_status", "status"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    sales_order_id: Mapped[int] = mapped_column(
        ForeignKey("sales_orders.id", ondelete="RESTRICT"),
        nullable=False,
    )
    number: Mapped[str] = mapped_column(String(80), nullable=False)
    project_seq: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default=DesignProjectStatus.DRAFT.value,
        server_default=DesignProjectStatus.DRAFT.value,
    )
    title: Mapped[str | None] = mapped_column(String(255), nullable=True)
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

    sales_order: Mapped[SalesOrder] = relationship("SalesOrder")
    versions: Mapped[list[DesignVersion]] = relationship(
        "DesignVersion",
        back_populates="design_project",
        cascade="all, delete-orphan",
        order_by="DesignVersion.version_no",
    )


class DesignVersion(Base):
    """Versioned design asset record inside a DesignProject (ADR-021)."""

    __tablename__ = "design_versions"
    __table_args__ = (
        UniqueConstraint(
            "design_project_id",
            "version_no",
            name="uq_design_versions_project_version_no",
        ),
        Index("ix_design_versions_design_project_id", "design_project_id"),
        Index("ix_design_versions_status", "status"),
        Index("ix_design_versions_sales_order_item_id", "sales_order_item_id"),
        Index("ix_design_versions_technical_card_id", "technical_card_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    design_project_id: Mapped[int] = mapped_column(
        ForeignKey("design_projects.id", ondelete="CASCADE"),
        nullable=False,
    )
    version_no: Mapped[int] = mapped_column(Integer, nullable=False)
    label: Mapped[str] = mapped_column(String(40), nullable=False)
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default=DesignVersionStatus.DRAFT.value,
        server_default=DesignVersionStatus.DRAFT.value,
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    sales_order_item_id: Mapped[int | None] = mapped_column(
        ForeignKey("sales_order_items.id", ondelete="SET NULL"),
        nullable=True,
    )
    technical_card_id: Mapped[int | None] = mapped_column(
        ForeignKey("technical_cards.id", ondelete="SET NULL"),
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

    design_project: Mapped[DesignProject] = relationship(
        "DesignProject",
        back_populates="versions",
    )
    sales_order_item: Mapped[SalesOrderItem | None] = relationship("SalesOrderItem")
    technical_card: Mapped[TechnicalCard | None] = relationship("TechnicalCard")
    assets: Mapped[list[DesignVersionAsset]] = relationship(
        "DesignVersionAsset",
        back_populates="design_version",
        cascade="all, delete-orphan",
        order_by="DesignVersionAsset.sort_order",
    )
    comments: Mapped[list[DesignVersionComment]] = relationship(
        "DesignVersionComment",
        back_populates="design_version",
        cascade="all, delete-orphan",
        order_by="DesignVersionComment.id",
    )


class DesignVersionAsset(Base):
    """File asset attached to a DesignVersion (ADR-022)."""

    __tablename__ = "design_version_assets"
    __table_args__ = (
        UniqueConstraint("storage_key", name="uq_design_version_assets_storage_key"),
        Index("ix_design_version_assets_design_version_id", "design_version_id"),
        Index("ix_design_version_assets_kind", "kind"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    design_version_id: Mapped[int] = mapped_column(
        ForeignKey("design_versions.id", ondelete="CASCADE"),
        nullable=False,
    )
    kind: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default=DesignVersionAssetKind.LAYOUT.value,
        server_default=DesignVersionAssetKind.LAYOUT.value,
    )
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    storage_key: Mapped[str] = mapped_column(String(500), nullable=False)
    mime_type: Mapped[str] = mapped_column(String(100), nullable=False)
    file_size: Mapped[int] = mapped_column(Integer, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_primary: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default="false",
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

    design_version: Mapped[DesignVersion] = relationship(
        "DesignVersion",
        back_populates="assets",
    )


class DesignVersionComment(Base):
    """Design-module comment on a DesignVersion (ADR-022; not Stage 19 chat)."""

    __tablename__ = "design_version_comments"
    __table_args__ = (
        Index("ix_design_version_comments_design_version_id", "design_version_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    design_version_id: Mapped[int] = mapped_column(
        ForeignKey("design_versions.id", ondelete="CASCADE"),
        nullable=False,
    )
    body: Mapped[str] = mapped_column(Text, nullable=False)
    author_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
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

    design_version: Mapped[DesignVersion] = relationship(
        "DesignVersion",
        back_populates="comments",
    )