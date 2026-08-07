"""Unified Work Tasks domain (ADR-028 / Stage 23)."""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base

if TYPE_CHECKING:
    from app.models.auth import PlatformUser
    from app.models.production_order import ProductionOrder
    from app.models.production_stage import ProductionStage
    from app.models.sales import Lead, SalesOrder


class WorkTaskStatus(str, Enum):
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    DONE = "done"
    CANCELLED = "cancelled"


class WorkTask(Base):
    """Internal work assignment with optional workshop and chat thread."""

    __tablename__ = "work_tasks"
    __table_args__ = (
        CheckConstraint(
            "("
            "(lead_id IS NOT NULL AND sales_order_id IS NULL AND production_order_id IS NULL) "
            "OR (lead_id IS NULL AND sales_order_id IS NOT NULL AND production_order_id IS NULL) "
            "OR (lead_id IS NULL AND sales_order_id IS NULL AND production_order_id IS NOT NULL)"
            ")",
            name="ck_work_tasks_anchor_xor",
        ),
        Index("ix_work_tasks_status", "status"),
        Index("ix_work_tasks_lead_id", "lead_id"),
        Index("ix_work_tasks_sales_order_id", "sales_order_id"),
        Index("ix_work_tasks_production_order_id", "production_order_id"),
        Index("ix_work_tasks_production_stage_id", "production_stage_id"),
        Index("ix_work_tasks_responsible_platform_user_id", "responsible_platform_user_id"),
        Index("ix_work_tasks_executor_platform_user_id", "executor_platform_user_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default=WorkTaskStatus.OPEN.value,
        server_default=WorkTaskStatus.OPEN.value,
    )
    production_stage_id: Mapped[int | None] = mapped_column(
        ForeignKey("production_stages.id", ondelete="SET NULL"),
        nullable=True,
    )
    responsible_platform_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("platform_users.id", ondelete="SET NULL"),
        nullable=True,
    )
    executor_platform_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("platform_users.id", ondelete="SET NULL"),
        nullable=True,
    )
    lead_id: Mapped[int | None] = mapped_column(
        ForeignKey("leads.id", ondelete="CASCADE"),
        nullable=True,
    )
    sales_order_id: Mapped[int | None] = mapped_column(
        ForeignKey("sales_orders.id", ondelete="CASCADE"),
        nullable=True,
    )
    production_order_id: Mapped[int | None] = mapped_column(
        ForeignKey("production_orders.id", ondelete="CASCADE"),
        nullable=True,
    )
    due_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
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
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    production_stage: Mapped[ProductionStage | None] = relationship("ProductionStage")
    responsible: Mapped[PlatformUser | None] = relationship(
        "PlatformUser",
        foreign_keys=[responsible_platform_user_id],
    )
    executor: Mapped[PlatformUser | None] = relationship(
        "PlatformUser",
        foreign_keys=[executor_platform_user_id],
    )
    lead: Mapped[Lead | None] = relationship("Lead")
    sales_order: Mapped[SalesOrder | None] = relationship("SalesOrder")
    production_order: Mapped[ProductionOrder | None] = relationship("ProductionOrder")
    messages: Mapped[list[WorkTaskMessage]] = relationship(
        back_populates="work_task",
        cascade="all, delete-orphan",
        order_by="WorkTaskMessage.id",
    )


class WorkTaskMessage(Base):
    """Chat message on a work task (Telegram-like thread)."""

    __tablename__ = "work_task_messages"
    __table_args__ = (
        Index("ix_work_task_messages_work_task_id", "work_task_id"),
        Index("ix_work_task_messages_created_at", "created_at"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    work_task_id: Mapped[int] = mapped_column(
        ForeignKey("work_tasks.id", ondelete="CASCADE"),
        nullable=False,
    )
    author_platform_user_id: Mapped[int] = mapped_column(
        ForeignKey("platform_users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    body: Mapped[str] = mapped_column(Text, nullable=False, default="", server_default="")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    work_task: Mapped[WorkTask] = relationship(back_populates="messages")
    author: Mapped[PlatformUser] = relationship("PlatformUser")
    attachments: Mapped[list[WorkTaskAttachment]] = relationship(
        back_populates="message",
        cascade="all, delete-orphan",
        order_by="WorkTaskAttachment.id",
    )


class WorkTaskAttachment(Base):
    """File attachment on a work-task message (stored under storage/task-media)."""

    __tablename__ = "work_task_attachments"
    __table_args__ = (
        Index("ix_work_task_attachments_message_id", "message_id"),
        Index("ix_work_task_attachments_storage_key", "storage_key", unique=True),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    message_id: Mapped[int] = mapped_column(
        ForeignKey("work_task_messages.id", ondelete="CASCADE"),
        nullable=False,
    )
    storage_key: Mapped[str] = mapped_column(String(500), nullable=False)
    mime_type: Mapped[str] = mapped_column(String(100), nullable=False)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    message: Mapped[WorkTaskMessage] = relationship(back_populates="attachments")
