from datetime import datetime
from enum import StrEnum

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base


class ImportStatus(StrEnum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class ImportRun(Base):
    __tablename__ = "import_runs"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        index=True,
    )

    source_id: Mapped[int] = mapped_column(
        ForeignKey("sources.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    status: Mapped[ImportStatus] = mapped_column(
        Enum(
            ImportStatus,
            name="import_status",
            native_enum=False,
        ),
        nullable=False,
        default=ImportStatus.PENDING,
        index=True,
    )

    started_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    finished_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    items_found: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
    )

    items_created: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
    )

    items_updated: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
    )

    items_skipped: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
    )

    error_message: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    trigger_type: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="manual",
    )

    source = relationship(
        "Source",
        back_populates="import_runs",
    )