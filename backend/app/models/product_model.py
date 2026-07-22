from __future__ import annotations

from datetime import datetime
from enum import Enum

from sqlalchemy import CheckConstraint, DateTime, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base


class ProductModelSizeType(str, Enum):
    MEN = "men"
    WOMEN = "women"
    KIDS = "kids"


class ProductModelStatus(str, Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    ARCHIVED = "archived"


class ProductModel(Base):
    """Flat product-model catalog (ADR-014 / product-model-domain.md).

    Version history (`ProductModelVersion`) is deferred to roadmap `6.1.6`.
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
