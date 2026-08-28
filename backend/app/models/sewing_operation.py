from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Table,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base

if TYPE_CHECKING:
    from app.models.shop_routing import WorkCenter

sewing_operation_work_centers = Table(
    "sewing_operation_work_centers",
    Base.metadata,
    Column(
        "sewing_operation_id",
        ForeignKey("sewing_operations.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "work_center_id",
        ForeignKey("work_centers.id", ondelete="CASCADE"),
        primary_key=True,
    ),
)


class SewingOperationFolder(Base):
    """Navigation folder for sewing-operations catalog (6.3.11). Not a snapshot target."""

    __tablename__ = "sewing_operation_folders"
    __table_args__ = (
        CheckConstraint(
            "sort_order >= 0",
            name="ck_sewing_operation_folders_sort_order_nonnegative",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    parent_id: Mapped[int | None] = mapped_column(
        ForeignKey("sewing_operation_folders.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
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

    parent: Mapped[SewingOperationFolder | None] = relationship(
        remote_side="SewingOperationFolder.id",
        back_populates="children",
    )
    children: Mapped[list[SewingOperationFolder]] = relationship(
        back_populates="parent",
    )
    operations: Mapped[list[SewingOperation]] = relationship(
        back_populates="folder",
    )


class SewingOperation(Base):
    """Leaf sewing-operation catalog row (name + description + folder + equipment).

    Economics live on `AssemblyOperationLine` (`26.10`).
    """

    __tablename__ = "sewing_operations"
    __table_args__ = (
        UniqueConstraint("name", name="uq_sewing_operations_name"),
        CheckConstraint(
            "sort_order >= 0",
            name="ck_sewing_operations_sort_order_nonnegative",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(String(256), nullable=True)
    folder_id: Mapped[int | None] = mapped_column(
        ForeignKey("sewing_operation_folders.id", ondelete="RESTRICT"),
        nullable=True,
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

    folder: Mapped[SewingOperationFolder | None] = relationship(
        back_populates="operations",
    )
    work_centers: Mapped[list[WorkCenter]] = relationship(
        "WorkCenter",
        secondary=sewing_operation_work_centers,
        lazy="selectin",
    )
