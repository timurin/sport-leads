from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from enum import Enum

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base


class NomenclatureType(str, Enum):
    SERVICE = "SERVICE"
    PRODUCT = "PRODUCT"
    GOODS = "GOODS"
    MATERIAL = "MATERIAL"


class UnitCategory(str, Enum):
    QUANTITY = "QUANTITY"
    LENGTH = "LENGTH"
    AREA = "AREA"
    MASS = "MASS"
    TIME = "TIME"
    SERVICE = "SERVICE"


class UnitOfMeasure(Base):
    __tablename__ = "units_of_measure"
    __table_args__ = (
        UniqueConstraint("code", name="uq_units_of_measure_code"),
        CheckConstraint("unit_category IN ('QUANTITY', 'LENGTH', 'AREA', 'MASS', 'TIME', 'SERVICE')", name="ck_units_of_measure_category"),
        CheckConstraint("precision >= 0 AND precision <= 6", name="ck_units_of_measure_precision"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    code: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    symbol: Mapped[str] = mapped_column(String(20), nullable=False)
    unit_category: Mapped[UnitCategory] = mapped_column(String(20), nullable=False, index=True)
    precision: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, index=True)
    is_system: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    nomenclatures: Mapped[list[Nomenclature]] = relationship(back_populates="storage_unit")


class NomenclatureCategory(Base):
    __tablename__ = "nomenclature_categories"
    __table_args__ = (
        UniqueConstraint("code", name="uq_nomenclature_categories_code"),
        CheckConstraint("nomenclature_type IN ('SERVICE', 'PRODUCT', 'GOODS', 'MATERIAL')", name="ck_nomenclature_categories_type"),
        CheckConstraint("sort_order >= 0", name="ck_nomenclature_categories_sort_order_nonnegative"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    parent_id: Mapped[int | None] = mapped_column(
        ForeignKey("nomenclature_categories.id", ondelete="RESTRICT"), nullable=True, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    code: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    nomenclature_type: Mapped[NomenclatureType] = mapped_column(String(20), nullable=False, index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, index=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    parent: Mapped[NomenclatureCategory | None] = relationship(
        remote_side="NomenclatureCategory.id", back_populates="children"
    )
    children: Mapped[list[NomenclatureCategory]] = relationship(back_populates="parent")
    nomenclatures: Mapped[list[Nomenclature]] = relationship(back_populates="category_relation")


class Nomenclature(Base):
    __tablename__ = "nomenclatures"
    __table_args__ = (
        CheckConstraint("nomenclature_type IN ('SERVICE', 'PRODUCT', 'GOODS', 'MATERIAL')", name="ck_nomenclatures_type"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    short_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    category: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    category_id: Mapped[int | None] = mapped_column(
        ForeignKey("nomenclature_categories.id", ondelete="SET NULL"), nullable=True, index=True
    )
    nomenclature_type: Mapped[NomenclatureType] = mapped_column(String(20), nullable=False, default=NomenclatureType.PRODUCT, index=True)
    unit: Mapped[str] = mapped_column(String(30), nullable=False, default="С€С‚")
    base_price: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False, default=Decimal("0"))
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="RUB")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    category_relation: Mapped[NomenclatureCategory | None] = relationship(back_populates="nomenclatures", foreign_keys=[category_id])
    storage_unit_id: Mapped[int | None] = mapped_column(ForeignKey("units_of_measure.id", ondelete="RESTRICT"), nullable=True, index=True)
    storage_unit: Mapped[UnitOfMeasure | None] = relationship(back_populates="nomenclatures", foreign_keys=[storage_unit_id])
