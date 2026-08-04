"""Print-form registry persistence (Stage 18.3.2)."""

from __future__ import annotations

from datetime import datetime
from enum import Enum

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
    text as sa_text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base


class PrintFormBindingType(str, Enum):
    MODEL = "model"
    DIRECTORY = "directory"
    DOCUMENT_TYPE = "document_type"


class PrintFormStatus(str, Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    ARCHIVED = "archived"


class PrintFormOutputFormat(str, Enum):
    HTML = "html"
    PDF = "pdf"
    XLSX = "xlsx"


class PrintFormVersioningMode(str, Enum):
    SINGLE_ACTIVE = "single_active"


class PrintFormVersionStorageKind(str, Enum):
    INLINE_TEXT = "inline_text"
    FILE_REF = "file_ref"


class PrintFormVersionStatus(str, Enum):
    DRAFT = "draft"
    PUBLISHED = "published"
    ARCHIVED = "archived"


class PrintForm(Base):
    __tablename__ = "print_forms"
    __table_args__ = (
        UniqueConstraint("code", name="uq_print_forms_code"),
        UniqueConstraint(
            "binding_type",
            "binding_key",
            "code",
            name="uq_print_forms_binding_code",
        ),
        CheckConstraint(
            "binding_type IN ('model', 'directory', 'document_type')",
            name="ck_print_forms_binding_type",
        ),
        CheckConstraint(
            "status IN ('draft', 'active', 'archived')",
            name="ck_print_forms_status",
        ),
        CheckConstraint(
            "output_format IN ('html', 'pdf', 'xlsx')",
            name="ck_print_forms_output_format",
        ),
        CheckConstraint(
            "versioning_mode IN ('single_active')",
            name="ck_print_forms_versioning_mode",
        ),
        CheckConstraint("length(trim(code)) > 0", name="ck_print_forms_code_nonempty"),
        CheckConstraint(
            "length(trim(title)) > 0",
            name="ck_print_forms_title_nonempty",
        ),
        CheckConstraint(
            "length(trim(binding_key)) > 0",
            name="ck_print_forms_binding_key_nonempty",
        ),
        Index("ix_print_forms_binding_type", "binding_type"),
        Index("ix_print_forms_binding_key", "binding_key"),
        Index("ix_print_forms_status", "status"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    code: Mapped[str] = mapped_column(String(80), nullable=False)
    title: Mapped[str] = mapped_column(String(160), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    binding_type: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default=PrintFormBindingType.MODEL.value,
        server_default=PrintFormBindingType.MODEL.value,
    )
    binding_key: Mapped[str] = mapped_column(String(120), nullable=False)
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default=PrintFormStatus.DRAFT.value,
        server_default=PrintFormStatus.DRAFT.value,
    )
    output_format: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default=PrintFormOutputFormat.HTML.value,
        server_default=PrintFormOutputFormat.HTML.value,
    )
    versioning_mode: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default=PrintFormVersioningMode.SINGLE_ACTIVE.value,
        server_default=PrintFormVersioningMode.SINGLE_ACTIVE.value,
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

    versions: Mapped[list["PrintFormVersion"]] = relationship(
        "PrintFormVersion",
        back_populates="print_form",
        cascade="all, delete-orphan",
        order_by="PrintFormVersion.version_no",
    )


class PrintFormVersion(Base):
    __tablename__ = "print_form_versions"
    __table_args__ = (
        UniqueConstraint(
            "print_form_id",
            "version_no",
            name="uq_print_form_versions_form_version_no",
        ),
        CheckConstraint(
            "version_no >= 1",
            name="ck_print_form_versions_version_no_positive",
        ),
        CheckConstraint(
            "status IN ('draft', 'published', 'archived')",
            name="ck_print_form_versions_status",
        ),
        CheckConstraint(
            "storage_kind IN ('inline_text', 'file_ref')",
            name="ck_print_form_versions_storage_kind",
        ),
        CheckConstraint(
            "length(trim(template_label)) > 0",
            name="ck_print_form_versions_label_nonempty",
        ),
        CheckConstraint(
            "length(trim(template_source)) > 0",
            name="ck_print_form_versions_source_nonempty",
        ),
        Index("ix_print_form_versions_print_form_id", "print_form_id"),
        Index("ix_print_form_versions_status", "status"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    print_form_id: Mapped[int] = mapped_column(
        ForeignKey("print_forms.id", ondelete="CASCADE"),
        nullable=False,
    )
    version_no: Mapped[int] = mapped_column(Integer, nullable=False)
    template_label: Mapped[str] = mapped_column(String(160), nullable=False)
    storage_kind: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default=PrintFormVersionStorageKind.INLINE_TEXT.value,
        server_default=PrintFormVersionStorageKind.INLINE_TEXT.value,
    )
    template_source: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default=PrintFormVersionStatus.DRAFT.value,
        server_default=PrintFormVersionStatus.DRAFT.value,
    )
    is_current: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default=sa_text("false"),
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

    print_form: Mapped[PrintForm] = relationship(
        "PrintForm",
        back_populates="versions",
    )
