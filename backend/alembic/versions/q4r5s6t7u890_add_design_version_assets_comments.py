"""Add design_version_assets and design_version_comments (ADR-022).

Revision ID: q4r5s6t7u890
Revises: p3q4r5s6t789
Roadmap: 10.1.2.2
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "q4r5s6t7u890"
down_revision = "p3q4r5s6t789"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "design_version_assets",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("design_version_id", sa.Integer(), nullable=False),
        sa.Column(
            "kind",
            sa.String(length=20),
            nullable=False,
            server_default="layout",
        ),
        sa.Column("filename", sa.String(length=255), nullable=False),
        sa.Column("storage_key", sa.String(length=500), nullable=False),
        sa.Column("mime_type", sa.String(length=100), nullable=False),
        sa.Column("file_size", sa.Integer(), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "is_primary",
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
            ["design_version_id"],
            ["design_versions.id"],
            name="fk_design_version_assets_design_version_id",
            ondelete="CASCADE",
        ),
        sa.UniqueConstraint("storage_key", name="uq_design_version_assets_storage_key"),
        sa.CheckConstraint("file_size > 0", name="ck_design_version_assets_file_size"),
        sa.CheckConstraint(
            "sort_order >= 0",
            name="ck_design_version_assets_sort_order",
        ),
        sa.CheckConstraint(
            "kind IN ('layout', 'logo', 'other')",
            name="ck_design_version_assets_kind",
        ),
    )
    op.create_index(
        "ix_design_version_assets_design_version_id",
        "design_version_assets",
        ["design_version_id"],
    )
    op.create_index("ix_design_version_assets_kind", "design_version_assets", ["kind"])
    # ≤1 primary asset per version (ADR-022).
    op.create_index(
        "uq_design_version_assets_one_primary",
        "design_version_assets",
        ["design_version_id"],
        unique=True,
        postgresql_where=sa.text("is_primary IS TRUE"),
        sqlite_where=sa.text("is_primary = 1"),
    )

    op.create_table(
        "design_version_comments",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("design_version_id", sa.Integer(), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("author_name", sa.String(length=255), nullable=True),
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
            ["design_version_id"],
            ["design_versions.id"],
            name="fk_design_version_comments_design_version_id",
            ondelete="CASCADE",
        ),
        sa.CheckConstraint(
            "length(trim(body)) > 0",
            name="ck_design_version_comments_body_nonempty",
        ),
    )
    op.create_index(
        "ix_design_version_comments_design_version_id",
        "design_version_comments",
        ["design_version_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_design_version_comments_design_version_id",
        table_name="design_version_comments",
    )
    op.drop_table("design_version_comments")
    op.drop_index(
        "uq_design_version_assets_one_primary",
        table_name="design_version_assets",
    )
    op.drop_index("ix_design_version_assets_kind", table_name="design_version_assets")
    op.drop_index(
        "ix_design_version_assets_design_version_id",
        table_name="design_version_assets",
    )
    op.drop_table("design_version_assets")
