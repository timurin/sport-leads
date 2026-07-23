from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Table,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base

CHARACTERISTIC_KINDS = (
    "STRING",
    "TEXT",
    "INTEGER",
    "DECIMAL",
    "BOOLEAN",
    "DATE",
    "LIST",
    "MULTI_SELECT",
    "COLOR",
)

OPTION_KINDS = frozenset({"LIST", "MULTI_SELECT", "COLOR"})
VARIANT_KINDS = frozenset({"LIST", "COLOR"})


nomenclature_characteristic_value_options = Table(
    "nomenclature_characteristic_value_options",
    Base.metadata,
    Column(
        "value_id",
        ForeignKey("nomenclature_characteristic_values.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "option_id",
        ForeignKey("characteristic_options.id", ondelete="RESTRICT"),
        primary_key=True,
    ),
)

category_characteristic_default_options = Table(
    "category_characteristic_default_options",
    Base.metadata,
    Column(
        "category_characteristic_id",
        ForeignKey("category_characteristics.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "option_id",
        ForeignKey("characteristic_options.id", ondelete="RESTRICT"),
        primary_key=True,
    ),
)


class CharacteristicDefinition(Base):
    __tablename__ = "characteristic_definitions"
    __table_args__ = (
        UniqueConstraint("code", name="uq_characteristic_definitions_code"),
        Index(
            "uq_characteristic_definitions_name_lower",
            text("lower(name)"),
            unique=True,
        ),
        CheckConstraint(
            "kind IN ('STRING', 'TEXT', 'INTEGER', 'DECIMAL', 'BOOLEAN', 'DATE', "
            "'LIST', 'MULTI_SELECT', 'COLOR')",
            name="ck_characteristic_definitions_kind",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    code: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    kind: Mapped[str] = mapped_column(
        String(20), nullable=False, default="LIST", server_default="LIST", index=True
    )
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    unit_id: Mapped[int | None] = mapped_column(
        ForeignKey("units_of_measure.id", ondelete="RESTRICT"), nullable=True, index=True
    )
    is_variant_dimension: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false", index=True
    )
    is_searchable: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_filterable: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_visible: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, index=True)
    is_system: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )


class CharacteristicOption(Base):
    __tablename__ = "characteristic_options"
    __table_args__ = (
        UniqueConstraint(
            "characteristic_id", "code", name="uq_characteristic_options_definition_code"
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    characteristic_id: Mapped[int] = mapped_column(
        ForeignKey("characteristic_definitions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    code: Mapped[str] = mapped_column(String(100), nullable=False)
    label: Mapped[str] = mapped_column(String(255), nullable=False)
    hex_value: Mapped[str | None] = mapped_column(String(7), nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )


class CategoryCharacteristic(Base):
    __tablename__ = "category_characteristics"
    __table_args__ = (
        UniqueConstraint(
            "category_id", "characteristic_id", name="uq_category_characteristics_pair"
        ),
        CheckConstraint(
            "sort_order >= 0", name="ck_category_characteristics_sort_order"
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    category_id: Mapped[int] = mapped_column(
        ForeignKey("nomenclature_categories.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    characteristic_id: Mapped[int] = mapped_column(
        ForeignKey("characteristic_definitions.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    is_required: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    inherit: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    is_visible: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    default_string_value: Mapped[str | None] = mapped_column(Text, nullable=True)
    default_integer_value: Mapped[int | None] = mapped_column(Integer, nullable=True)
    default_decimal_value: Mapped[Decimal | None] = mapped_column(
        Numeric(18, 6), nullable=True
    )
    default_boolean_value: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    default_date_value: Mapped[date | None] = mapped_column(Date, nullable=True)
    default_option_id: Mapped[int | None] = mapped_column(
        ForeignKey("characteristic_options.id", ondelete="RESTRICT"), nullable=True
    )
    default_options: Mapped[list[CharacteristicOption]] = relationship(
        secondary=category_characteristic_default_options
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )


class NomenclatureCharacteristic(Base):
    __tablename__ = "nomenclature_characteristics"
    __table_args__ = (
        UniqueConstraint(
            "nomenclature_id",
            "characteristic_id",
            name="uq_nomenclature_characteristics_pair",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    nomenclature_id: Mapped[int] = mapped_column(
        ForeignKey("nomenclatures.id", ondelete="CASCADE"), nullable=False, index=True
    )
    characteristic_id: Mapped[int] = mapped_column(
        ForeignKey("characteristic_definitions.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )


class NomenclatureCharacteristicValue(Base):
    __tablename__ = "nomenclature_characteristic_values"
    __table_args__ = (
        UniqueConstraint(
            "nomenclature_id",
            "characteristic_id",
            name="uq_nomenclature_characteristic_values_pair",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    nomenclature_id: Mapped[int] = mapped_column(
        ForeignKey("nomenclatures.id", ondelete="CASCADE"), nullable=False, index=True
    )
    characteristic_id: Mapped[int] = mapped_column(
        ForeignKey("characteristic_definitions.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    string_value: Mapped[str | None] = mapped_column(Text, nullable=True)
    integer_value: Mapped[int | None] = mapped_column(Integer, nullable=True)
    decimal_value: Mapped[Decimal | None] = mapped_column(Numeric(18, 6), nullable=True)
    boolean_value: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    date_value: Mapped[date | None] = mapped_column(Date, nullable=True)
    option_id: Mapped[int | None] = mapped_column(
        ForeignKey("characteristic_options.id", ondelete="RESTRICT"), nullable=True
    )
    options: Mapped[list[CharacteristicOption]] = relationship(
        secondary=nomenclature_characteristic_value_options
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )


class NomenclatureVariant(Base):
    __tablename__ = "nomenclature_variants"
    __table_args__ = (
        UniqueConstraint("article", name="uq_nomenclature_variants_article"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    nomenclature_id: Mapped[int] = mapped_column(
        ForeignKey("nomenclatures.id", ondelete="CASCADE"), nullable=False, index=True
    )
    article: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )


variant_options = Table(
    "nomenclature_variant_options",
    Base.metadata,
    Column(
        "variant_id",
        ForeignKey("nomenclature_variants.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "option_id",
        ForeignKey("characteristic_options.id", ondelete="RESTRICT"),
        primary_key=True,
    ),
)
