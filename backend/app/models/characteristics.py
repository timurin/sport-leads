from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, Integer, String, Table, Column, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base


class CharacteristicDefinition(Base):
    __tablename__ = "characteristic_definitions"
    __table_args__ = (UniqueConstraint("code", name="uq_characteristic_definitions_code"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    code: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    kind: Mapped[str] = mapped_column(String(20), nullable=False, default="LIST", server_default="LIST", index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())


class CharacteristicOption(Base):
    __tablename__ = "characteristic_options"
    __table_args__ = (UniqueConstraint("characteristic_id", "code", name="uq_characteristic_options_definition_code"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    characteristic_id: Mapped[int] = mapped_column(ForeignKey("characteristic_definitions.id", ondelete="CASCADE"), nullable=False, index=True)
    code: Mapped[str] = mapped_column(String(100), nullable=False)
    label: Mapped[str] = mapped_column(String(255), nullable=False)
    hex_value: Mapped[str | None] = mapped_column(String(7), nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())


class CategoryCharacteristic(Base):
    __tablename__ = "category_characteristics"
    __table_args__ = (UniqueConstraint("category_id", "characteristic_id", name="uq_category_characteristics_pair"), CheckConstraint("sort_order >= 0", name="ck_category_characteristics_sort_order"))

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    category_id: Mapped[int] = mapped_column(ForeignKey("nomenclature_categories.id", ondelete="CASCADE"), nullable=False, index=True)
    characteristic_id: Mapped[int] = mapped_column(ForeignKey("characteristic_definitions.id", ondelete="RESTRICT"), nullable=False, index=True)
    is_required: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    inherit: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())


class NomenclatureCharacteristic(Base):
    __tablename__ = "nomenclature_characteristics"
    __table_args__ = (UniqueConstraint("nomenclature_id", "characteristic_id", name="uq_nomenclature_characteristics_pair"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    nomenclature_id: Mapped[int] = mapped_column(ForeignKey("nomenclatures.id", ondelete="CASCADE"), nullable=False, index=True)
    characteristic_id: Mapped[int] = mapped_column(ForeignKey("characteristic_definitions.id", ondelete="RESTRICT"), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())


class NomenclatureVariant(Base):
    __tablename__ = "nomenclature_variants"
    __table_args__ = (UniqueConstraint("article", name="uq_nomenclature_variants_article"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    nomenclature_id: Mapped[int] = mapped_column(ForeignKey("nomenclatures.id", ondelete="CASCADE"), nullable=False, index=True)
    article: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())


variant_options = Table(
    "nomenclature_variant_options",
    Base.metadata,
    Column("variant_id", ForeignKey("nomenclature_variants.id", ondelete="CASCADE"), primary_key=True),
    Column("option_id", ForeignKey("characteristic_options.id", ondelete="RESTRICT"), primary_key=True),
)
