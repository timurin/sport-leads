"""Internal collaboration / order chat (ADR-026 / Stage 19)."""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING

from sqlalchemy import (
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
    from app.models.auth import PlatformUser
    from app.models.sales import SalesOrder
    from app.models.technical_card import TechnicalCard


class CollaborationMicrotaskStatus(str, Enum):
    OPEN = "open"
    DONE = "done"


class CollaborationThread(Base):
    """One staff collaboration thread per sales order (ADR-026)."""

    __tablename__ = "collaboration_threads"
    __table_args__ = (
        UniqueConstraint("sales_order_id", name="uq_collaboration_threads_sales_order_id"),
        Index("ix_collaboration_threads_sales_order_id", "sales_order_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    sales_order_id: Mapped[int] = mapped_column(
        ForeignKey("sales_orders.id", ondelete="CASCADE"),
        nullable=False,
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

    sales_order: Mapped[SalesOrder] = relationship("SalesOrder")
    messages: Mapped[list[CollaborationMessage]] = relationship(
        back_populates="thread",
        cascade="all, delete-orphan",
        order_by="CollaborationMessage.id",
    )


class CollaborationMessage(Base):
    """Staff message on an order collaboration thread."""

    __tablename__ = "collaboration_messages"
    __table_args__ = (
        Index("ix_collaboration_messages_thread_id", "thread_id"),
        Index("ix_collaboration_messages_technical_card_id", "technical_card_id"),
        Index("ix_collaboration_messages_created_at", "created_at"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    thread_id: Mapped[int] = mapped_column(
        ForeignKey("collaboration_threads.id", ondelete="CASCADE"),
        nullable=False,
    )
    author_platform_user_id: Mapped[int] = mapped_column(
        ForeignKey("platform_users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    body: Mapped[str] = mapped_column(Text, nullable=False)
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

    thread: Mapped[CollaborationThread] = relationship(back_populates="messages")
    author: Mapped[PlatformUser] = relationship("PlatformUser")
    technical_card: Mapped[TechnicalCard | None] = relationship("TechnicalCard")
    mentions: Mapped[list[CollaborationMention]] = relationship(
        back_populates="message",
        cascade="all, delete-orphan",
    )


class CollaborationMention(Base):
    """@mention of a platform user inside a collaboration message."""

    __tablename__ = "collaboration_mentions"
    __table_args__ = (
        UniqueConstraint(
            "message_id",
            "mentioned_platform_user_id",
            name="uq_collaboration_mentions_message_user",
        ),
        Index("ix_collaboration_mentions_message_id", "message_id"),
        Index(
            "ix_collaboration_mentions_mentioned_platform_user_id",
            "mentioned_platform_user_id",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    message_id: Mapped[int] = mapped_column(
        ForeignKey("collaboration_messages.id", ondelete="CASCADE"),
        nullable=False,
    )
    mentioned_platform_user_id: Mapped[int] = mapped_column(
        ForeignKey("platform_users.id", ondelete="CASCADE"),
        nullable=False,
    )
    mentioned_login_snapshot: Mapped[str] = mapped_column(String(64), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    message: Mapped[CollaborationMessage] = relationship(back_populates="mentions")
    mentioned_user: Mapped[PlatformUser] = relationship("PlatformUser")


class CollaborationMicrotask(Base):
    """Platform microtask created from order chat (ADR-026)."""

    __tablename__ = "collaboration_microtasks"
    __table_args__ = (
        Index("ix_collaboration_microtasks_sales_order_id", "sales_order_id"),
        Index("ix_collaboration_microtasks_assignee", "assignee_platform_user_id"),
        Index("ix_collaboration_microtasks_status", "status"),
        Index("ix_collaboration_microtasks_technical_card_id", "technical_card_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    sales_order_id: Mapped[int] = mapped_column(
        ForeignKey("sales_orders.id", ondelete="CASCADE"),
        nullable=False,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default=CollaborationMicrotaskStatus.OPEN.value,
        server_default=CollaborationMicrotaskStatus.OPEN.value,
    )
    assignee_platform_user_id: Mapped[int] = mapped_column(
        ForeignKey("platform_users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    created_by_platform_user_id: Mapped[int] = mapped_column(
        ForeignKey("platform_users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    technical_card_id: Mapped[int | None] = mapped_column(
        ForeignKey("technical_cards.id", ondelete="SET NULL"),
        nullable=True,
    )
    source_message_id: Mapped[int | None] = mapped_column(
        ForeignKey("collaboration_messages.id", ondelete="SET NULL"),
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
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    sales_order: Mapped[SalesOrder] = relationship("SalesOrder")
    assignee: Mapped[PlatformUser] = relationship(
        "PlatformUser",
        foreign_keys=[assignee_platform_user_id],
    )
    created_by: Mapped[PlatformUser] = relationship(
        "PlatformUser",
        foreign_keys=[created_by_platform_user_id],
    )
    technical_card: Mapped[TechnicalCard | None] = relationship("TechnicalCard")
    source_message: Mapped[CollaborationMessage | None] = relationship(
        "CollaborationMessage"
    )


class CollaborationNotificationKind(str, Enum):
    MENTION = "mention"
    MICROTASK_ASSIGNED = "microtask_assigned"
    MICROTASK_COMPLETED = "microtask_completed"


class CollaborationNotification(Base):
    """In-app notification for order-chat mentions / microtasks (Stage 19.4)."""

    __tablename__ = "collaboration_notifications"
    __table_args__ = (
        Index("ix_collaboration_notifications_recipient", "recipient_platform_user_id"),
        Index("ix_collaboration_notifications_created_at", "created_at"),
        Index("ix_collaboration_notifications_read_at", "read_at"),
        Index("ix_collaboration_notifications_kind", "kind"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    recipient_platform_user_id: Mapped[int] = mapped_column(
        ForeignKey("platform_users.id", ondelete="CASCADE"),
        nullable=False,
    )
    kind: Mapped[str] = mapped_column(String(40), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    sales_order_id: Mapped[int] = mapped_column(
        ForeignKey("sales_orders.id", ondelete="CASCADE"),
        nullable=False,
    )
    technical_card_id: Mapped[int | None] = mapped_column(
        ForeignKey("technical_cards.id", ondelete="SET NULL"),
        nullable=True,
    )
    source_message_id: Mapped[int | None] = mapped_column(
        ForeignKey("collaboration_messages.id", ondelete="SET NULL"),
        nullable=True,
    )
    microtask_id: Mapped[int | None] = mapped_column(
        ForeignKey("collaboration_microtasks.id", ondelete="SET NULL"),
        nullable=True,
    )
    actor_platform_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("platform_users.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    read_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    recipient: Mapped[PlatformUser] = relationship(
        "PlatformUser",
        foreign_keys=[recipient_platform_user_id],
    )
