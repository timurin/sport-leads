from __future__ import annotations

from datetime import datetime

from sqlalchemy import (
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


detailing_item_product_types = Table(
    "detailing_item_product_types",
    Base.metadata,
    Column(
        "detailing_item_id",
        Integer,
        ForeignKey("detailing_items.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "product_type_id",
        Integer,
        ForeignKey("product_types.id", ondelete="RESTRICT"),
        primary_key=True,
    ),
)


class DetailingItem(Base):
    """Catalog «Деталировка» (Stage 26.13 / ADR-035)."""

    __tablename__ = "detailing_items"
    __table_args__ = (UniqueConstraint("name", name="uq_detailing_items_name"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
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

    applicability_product_types = relationship(
        "ProductType",
        secondary=detailing_item_product_types,
        lazy="selectin",
        order_by="ProductType.name",
    )
