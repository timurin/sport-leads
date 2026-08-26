"""Lead card extra fields (Stage 26.5 — owner-defined KV per block)."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base

LEAD_CARD_FIELD_BLOCKS = ("customer", "interest", "delivery", "metrics")


class LeadCardFieldDefinition(Base):
    __tablename__ = "lead_card_field_definitions"
    __table_args__ = (
        CheckConstraint(
            "block IN ('customer', 'interest', 'delivery', 'metrics')",
            name="ck_lead_card_field_definitions_block",
        ),
        CheckConstraint(
            "sort_order >= 0",
            name="ck_lead_card_field_definitions_sort_order",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    block: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    label: Mapped[str] = mapped_column(String(120), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )
    values: Mapped[list[LeadCardFieldValue]] = relationship(
        back_populates="definition",
        cascade="all, delete-orphan",
    )


class LeadCardFieldValue(Base):
    __tablename__ = "lead_card_field_values"
    __table_args__ = (
        UniqueConstraint(
            "lead_id",
            "definition_id",
            name="uq_lead_card_field_values_lead_definition",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    lead_id: Mapped[int] = mapped_column(
        ForeignKey("leads.id", ondelete="CASCADE"), nullable=False, index=True
    )
    definition_id: Mapped[int] = mapped_column(
        ForeignKey("lead_card_field_definitions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    value: Mapped[str] = mapped_column(Text, nullable=False, default="")
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )
    definition: Mapped[LeadCardFieldDefinition] = relationship(back_populates="values")
