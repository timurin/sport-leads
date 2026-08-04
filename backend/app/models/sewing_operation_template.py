from __future__ import annotations

from datetime import datetime

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base
from app.models.sewing_operation import SewingOperation


class SewingOperationTemplate(Base):
    """Named pack of sewing-operation refs (6.3.12). No cost snapshot on lines."""

    __tablename__ = "sewing_operation_templates"
    __table_args__ = (
        UniqueConstraint("name", name="uq_sewing_operation_templates_name"),
    )

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

    lines: Mapped[list[SewingOperationTemplateLine]] = relationship(
        back_populates="template",
        cascade="all, delete-orphan",
        order_by="SewingOperationTemplateLine.sequence",
    )


class SewingOperationTemplateLine(Base):
    __tablename__ = "sewing_operation_template_lines"
    __table_args__ = (
        CheckConstraint(
            "sequence >= 1",
            name="ck_sewing_operation_template_lines_sequence_positive",
        ),
        UniqueConstraint(
            "template_id",
            "sequence",
            name="uq_sewing_operation_template_lines_template_sequence",
        ),
        UniqueConstraint(
            "template_id",
            "sewing_operation_id",
            name="uq_sewing_operation_template_lines_template_op",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    template_id: Mapped[int] = mapped_column(
        ForeignKey("sewing_operation_templates.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    sewing_operation_id: Mapped[int] = mapped_column(
        ForeignKey("sewing_operations.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    sequence: Mapped[int] = mapped_column(Integer, nullable=False)

    template: Mapped[SewingOperationTemplate] = relationship(back_populates="lines")
    sewing_operation: Mapped[SewingOperation] = relationship()
