"""Add print-form registry and versions (18.3.2).

Revision ID: z3a4b5c6d789
Revises: y2z3a4b5c678
Roadmap: 18.3.2
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "z3a4b5c6d789"
down_revision = "y2z3a4b5c678"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "print_forms",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("code", sa.String(length=80), nullable=False),
        sa.Column("title", sa.String(length=160), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "binding_type",
            sa.String(length=20),
            nullable=False,
            server_default="model",
        ),
        sa.Column("binding_key", sa.String(length=120), nullable=False),
        sa.Column(
            "status",
            sa.String(length=20),
            nullable=False,
            server_default="draft",
        ),
        sa.Column(
            "output_format",
            sa.String(length=20),
            nullable=False,
            server_default="html",
        ),
        sa.Column(
            "versioning_mode",
            sa.String(length=20),
            nullable=False,
            server_default="single_active",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.UniqueConstraint("code", name="uq_print_forms_code"),
        sa.UniqueConstraint(
            "binding_type",
            "binding_key",
            "code",
            name="uq_print_forms_binding_code",
        ),
        sa.CheckConstraint(
            "binding_type IN ('model', 'directory', 'document_type')",
            name="ck_print_forms_binding_type",
        ),
        sa.CheckConstraint(
            "status IN ('draft', 'active', 'archived')",
            name="ck_print_forms_status",
        ),
        sa.CheckConstraint(
            "output_format IN ('html', 'pdf', 'xlsx')",
            name="ck_print_forms_output_format",
        ),
        sa.CheckConstraint(
            "versioning_mode IN ('single_active')",
            name="ck_print_forms_versioning_mode",
        ),
        sa.CheckConstraint(
            "length(trim(code)) > 0",
            name="ck_print_forms_code_nonempty",
        ),
        sa.CheckConstraint(
            "length(trim(title)) > 0",
            name="ck_print_forms_title_nonempty",
        ),
        sa.CheckConstraint(
            "length(trim(binding_key)) > 0",
            name="ck_print_forms_binding_key_nonempty",
        ),
    )
    op.create_index("ix_print_forms_binding_type", "print_forms", ["binding_type"])
    op.create_index("ix_print_forms_binding_key", "print_forms", ["binding_key"])
    op.create_index("ix_print_forms_status", "print_forms", ["status"])

    op.create_table(
        "print_form_versions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("print_form_id", sa.Integer(), nullable=False),
        sa.Column("version_no", sa.Integer(), nullable=False),
        sa.Column("template_label", sa.String(length=160), nullable=False),
        sa.Column(
            "storage_kind",
            sa.String(length=20),
            nullable=False,
            server_default="inline_text",
        ),
        sa.Column("template_source", sa.Text(), nullable=False),
        sa.Column(
            "status",
            sa.String(length=20),
            nullable=False,
            server_default="draft",
        ),
        sa.Column(
            "is_current",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(
            ["print_form_id"],
            ["print_forms.id"],
            name="fk_print_form_versions_print_form_id",
            ondelete="CASCADE",
        ),
        sa.UniqueConstraint(
            "print_form_id",
            "version_no",
            name="uq_print_form_versions_form_version_no",
        ),
        sa.CheckConstraint(
            "version_no >= 1",
            name="ck_print_form_versions_version_no_positive",
        ),
        sa.CheckConstraint(
            "status IN ('draft', 'published', 'archived')",
            name="ck_print_form_versions_status",
        ),
        sa.CheckConstraint(
            "storage_kind IN ('inline_text', 'file_ref')",
            name="ck_print_form_versions_storage_kind",
        ),
        sa.CheckConstraint(
            "length(trim(template_label)) > 0",
            name="ck_print_form_versions_label_nonempty",
        ),
        sa.CheckConstraint(
            "length(trim(template_source)) > 0",
            name="ck_print_form_versions_source_nonempty",
        ),
    )
    op.create_index(
        "ix_print_form_versions_print_form_id",
        "print_form_versions",
        ["print_form_id"],
    )
    op.create_index(
        "ix_print_form_versions_status",
        "print_form_versions",
        ["status"],
    )
    op.create_index(
        "uq_print_form_versions_one_current",
        "print_form_versions",
        ["print_form_id"],
        unique=True,
        postgresql_where=sa.text("is_current IS TRUE"),
        sqlite_where=sa.text("is_current = 1"),
    )


def downgrade() -> None:
    op.drop_index(
        "uq_print_form_versions_one_current",
        table_name="print_form_versions",
    )
    op.drop_index(
        "ix_print_form_versions_status",
        table_name="print_form_versions",
    )
    op.drop_index(
        "ix_print_form_versions_print_form_id",
        table_name="print_form_versions",
    )
    op.drop_table("print_form_versions")
    op.drop_index("ix_print_forms_status", table_name="print_forms")
    op.drop_index("ix_print_forms_binding_key", table_name="print_forms")
    op.drop_index("ix_print_forms_binding_type", table_name="print_forms")
    op.drop_table("print_forms")
