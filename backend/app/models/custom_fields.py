from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from enum import Enum

from sqlalchemy import Boolean, CheckConstraint, Date, DateTime, ForeignKey, Index, Integer, Numeric, String, Text, UniqueConstraint, func, Table, Column, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base


class CustomFieldDataType(str, Enum):
    STRING = "STRING"
    TEXT = "TEXT"
    INTEGER = "INTEGER"
    DECIMAL = "DECIMAL"
    BOOLEAN = "BOOLEAN"
    DATE = "DATE"
    SINGLE_SELECT = "SINGLE_SELECT"
    MULTI_SELECT = "MULTI_SELECT"
    COLOR = "COLOR"


field_value_options = Table(
    "nomenclature_field_value_options",
    Base.metadata,
    Column("field_value_id", ForeignKey("nomenclature_field_values.id", ondelete="CASCADE"), primary_key=True),
    Column("option_id", ForeignKey("custom_field_options.id", ondelete="RESTRICT"), primary_key=True),
)

category_field_default_options = Table(
    "category_field_default_options",
    Base.metadata,
    Column("category_field_id", ForeignKey("category_fields.id", ondelete="CASCADE"), primary_key=True),
    Column("option_id", ForeignKey("custom_field_options.id", ondelete="RESTRICT"), primary_key=True),
)


class CustomFieldDefinition(Base):
    __tablename__ = "custom_field_definitions"
    __table_args__ = (
        UniqueConstraint("code", name="uq_custom_field_definitions_code"),
        Index(
            "uq_custom_field_definitions_name_lower",
            text("lower(name)"),
            unique=True,
        ),
        CheckConstraint("data_type IN ('STRING', 'TEXT', 'INTEGER', 'DECIMAL', 'BOOLEAN', 'DATE', 'SINGLE_SELECT', 'MULTI_SELECT', 'COLOR')", name="ck_custom_field_definitions_data_type"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    code: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    data_type: Mapped[CustomFieldDataType] = mapped_column(String(20), nullable=False, index=True)
    unit_id: Mapped[int | None] = mapped_column(ForeignKey("units_of_measure.id", ondelete="RESTRICT"), nullable=True, index=True)
    is_searchable: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_filterable: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_visible: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, index=True)
    is_system: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())


class CustomFieldOption(Base):
    __tablename__ = "custom_field_options"
    __table_args__ = (UniqueConstraint("field_definition_id", "code", name="uq_custom_field_options_field_code"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    field_definition_id: Mapped[int] = mapped_column(ForeignKey("custom_field_definitions.id", ondelete="CASCADE"), nullable=False, index=True)
    code: Mapped[str] = mapped_column(String(100), nullable=False)
    label: Mapped[str] = mapped_column(String(255), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())


class CategoryField(Base):
    __tablename__ = "category_fields"
    __table_args__ = (UniqueConstraint("category_id", "field_definition_id", name="uq_category_fields_category_definition"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    category_id: Mapped[int] = mapped_column(ForeignKey("nomenclature_categories.id", ondelete="CASCADE"), nullable=False, index=True)
    field_definition_id: Mapped[int] = mapped_column(ForeignKey("custom_field_definitions.id", ondelete="RESTRICT"), nullable=False, index=True)
    is_required: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    inherit: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    is_visible: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    default_string_value: Mapped[str | None] = mapped_column(Text, nullable=True)
    default_integer_value: Mapped[int | None] = mapped_column(Integer, nullable=True)
    default_decimal_value: Mapped[Decimal | None] = mapped_column(Numeric(18, 6), nullable=True)
    default_boolean_value: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    default_date_value: Mapped[date | None] = mapped_column(Date, nullable=True)
    default_option_id: Mapped[int | None] = mapped_column(ForeignKey("custom_field_options.id", ondelete="RESTRICT"), nullable=True)
    default_options: Mapped[list[CustomFieldOption]] = relationship(secondary=category_field_default_options)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())


class NomenclatureFieldValue(Base):
    __tablename__ = "nomenclature_field_values"
    __table_args__ = (UniqueConstraint("nomenclature_id", "field_definition_id", name="uq_nomenclature_field_values_definition"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    nomenclature_id: Mapped[int] = mapped_column(ForeignKey("nomenclatures.id", ondelete="CASCADE"), nullable=False, index=True)
    field_definition_id: Mapped[int] = mapped_column(ForeignKey("custom_field_definitions.id", ondelete="RESTRICT"), nullable=False, index=True)
    string_value: Mapped[str | None] = mapped_column(Text, nullable=True)
    integer_value: Mapped[int | None] = mapped_column(Integer, nullable=True)
    decimal_value: Mapped[Decimal | None] = mapped_column(Numeric(18, 6), nullable=True)
    boolean_value: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    date_value: Mapped[date | None] = mapped_column(Date, nullable=True)
    option_id: Mapped[int | None] = mapped_column(ForeignKey("custom_field_options.id", ondelete="RESTRICT"), nullable=True)
    options: Mapped[list[CustomFieldOption]] = relationship(secondary=field_value_options)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
