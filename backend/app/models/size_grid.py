from __future__ import annotations

from datetime import datetime
from enum import Enum

from sqlalchemy import (
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


class SizeGridSizeType(str, Enum):
    MEN = "men"
    WOMEN = "women"
    KIDS = "kids"


class SizeGrid(Base):
    """Size-grid catalog document — one size_type per grid (Variant A / 6.2)."""

    __tablename__ = "size_grids"
    __table_args__ = (
        UniqueConstraint("name", name="uq_size_grids_name"),
        CheckConstraint(
            "size_type IN ('men', 'women', 'kids')",
            name="ck_size_grids_size_type",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    size_type: Mapped[SizeGridSizeType] = mapped_column(
        String(20),
        nullable=False,
        index=True,
    )
    source_note: Mapped[str | None] = mapped_column(Text, nullable=True)
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

    rows: Mapped[list[SizeGridRow]] = relationship(
        "SizeGridRow",
        back_populates="size_grid",
        cascade="all, delete-orphan",
        order_by="SizeGridRow.sort_order",
    )


class SizeGridRow(Base):
    """One size line inside a SizeGrid (Mosmade-style reference labels)."""

    __tablename__ = "size_grid_rows"
    __table_args__ = (
        UniqueConstraint(
            "size_grid_id",
            "ru_size",
            "int_label",
            name="uq_size_grid_rows_grid_ru_int",
        ),
        CheckConstraint("sort_order >= 0", name="ck_size_grid_rows_sort_order"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    size_grid_id: Mapped[int] = mapped_column(
        ForeignKey("size_grids.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    ru_size: Mapped[str] = mapped_column(String(32), nullable=False)
    int_label: Mapped[str] = mapped_column(String(32), nullable=False)
    # Reference labels from Mosmade (e.g. "92-96"), not numeric min/max.
    chest: Mapped[str] = mapped_column(String(64), nullable=False)
    waist: Mapped[str] = mapped_column(String(64), nullable=False)
    hip: Mapped[str] = mapped_column(String(64), nullable=False)
    height_s: Mapped[str | None] = mapped_column(String(64), nullable=True)
    height_n: Mapped[str | None] = mapped_column(String(64), nullable=True)
    height_t: Mapped[str | None] = mapped_column(String(64), nullable=True)

    size_grid: Mapped[SizeGrid] = relationship("SizeGrid", back_populates="rows")
