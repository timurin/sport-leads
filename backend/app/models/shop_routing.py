"""Shop routing templates, stage lines, and work centers (ADR-017 / Stage 8.1.2)."""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

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

if TYPE_CHECKING:
    from app.models.tech_operation import TechOperation


class WorkCenter(Base):
    """Flat work-center / shop-area directory (MVP)."""

    __tablename__ = "work_centers"
    __table_args__ = (
        UniqueConstraint("name", name="uq_work_centers_name"),
        UniqueConstraint("code", name="uq_work_centers_code"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    code: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, index=True
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


class ShopRoutingTemplate(Base):
    """Named shop-floor routing preset (ordered stages)."""

    __tablename__ = "shop_routing_templates"
    __table_args__ = (
        UniqueConstraint("name", name="uq_shop_routing_templates_name"),
        UniqueConstraint("code", name="uq_shop_routing_templates_code"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    code: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, index=True
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

    stage_lines: Mapped[list[ShopRoutingStageLine]] = relationship(
        back_populates="routing_template",
        cascade="all, delete-orphan",
        order_by="ShopRoutingStageLine.stage_order, ShopRoutingStageLine.id",
    )


class ShopRoutingStageLine(Base):
    """Ordered stage within a shop routing template."""

    __tablename__ = "shop_routing_stage_lines"
    __table_args__ = (
        UniqueConstraint(
            "routing_template_id",
            "stage_order",
            name="uq_shop_routing_stage_lines_template_order",
        ),
        CheckConstraint(
            "stage_order >= 1",
            name="ck_shop_routing_stage_lines_stage_order",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    routing_template_id: Mapped[int] = mapped_column(
        ForeignKey("shop_routing_templates.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    stage_order: Mapped[int] = mapped_column(Integer, nullable=False)
    stage_label: Mapped[str] = mapped_column(String(255), nullable=False)
    tech_operation_id: Mapped[int | None] = mapped_column(
        ForeignKey("tech_operations.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    work_center_id: Mapped[int | None] = mapped_column(
        ForeignKey("work_centers.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    is_quality_checkpoint: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
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

    routing_template: Mapped[ShopRoutingTemplate] = relationship(
        back_populates="stage_lines"
    )
    tech_operation: Mapped[TechOperation | None] = relationship()
    work_center: Mapped[WorkCenter | None] = relationship()
