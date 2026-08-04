"""Add design_projects and design_versions (ADR-021).

Revision ID: p3q4r5s6t789
Revises: o2p3q4r5s678
Roadmap: 10.1.1.2
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "p3q4r5s6t789"
down_revision = "o2p3q4r5s678"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "design_projects",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("sales_order_id", sa.Integer(), nullable=False),
        sa.Column("number", sa.String(length=80), nullable=False),
        sa.Column("project_seq", sa.Integer(), nullable=False),
        sa.Column(
            "status",
            sa.String(length=20),
            nullable=False,
            server_default="draft",
        ),
        sa.Column("title", sa.String(length=255), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
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
            ["sales_order_id"],
            ["sales_orders.id"],
            name="fk_design_projects_sales_order_id",
            ondelete="RESTRICT",
        ),
        sa.UniqueConstraint(
            "sales_order_id",
            "project_seq",
            name="uq_design_projects_sales_order_seq",
        ),
        sa.UniqueConstraint("number", name="uq_design_projects_number"),
    )
    op.create_index(
        "ix_design_projects_sales_order_id",
        "design_projects",
        ["sales_order_id"],
    )
    op.create_index("ix_design_projects_status", "design_projects", ["status"])

    op.create_table(
        "design_versions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("design_project_id", sa.Integer(), nullable=False),
        sa.Column("version_no", sa.Integer(), nullable=False),
        sa.Column("label", sa.String(length=40), nullable=False),
        sa.Column(
            "status",
            sa.String(length=20),
            nullable=False,
            server_default="draft",
        ),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("sales_order_item_id", sa.Integer(), nullable=True),
        sa.Column("technical_card_id", sa.Integer(), nullable=True),
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
            ["design_project_id"],
            ["design_projects.id"],
            name="fk_design_versions_design_project_id",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["sales_order_item_id"],
            ["sales_order_items.id"],
            name="fk_design_versions_sales_order_item_id",
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["technical_card_id"],
            ["technical_cards.id"],
            name="fk_design_versions_technical_card_id",
            ondelete="SET NULL",
        ),
        sa.UniqueConstraint(
            "design_project_id",
            "version_no",
            name="uq_design_versions_project_version_no",
        ),
    )
    op.create_index(
        "ix_design_versions_design_project_id",
        "design_versions",
        ["design_project_id"],
    )
    op.create_index("ix_design_versions_status", "design_versions", ["status"])
    op.create_index(
        "ix_design_versions_sales_order_item_id",
        "design_versions",
        ["sales_order_item_id"],
    )
    op.create_index(
        "ix_design_versions_technical_card_id",
        "design_versions",
        ["technical_card_id"],
    )
    # ≤1 current version per project (ADR-021); enforced in Postgres.
    op.create_index(
        "uq_design_versions_one_current",
        "design_versions",
        ["design_project_id"],
        unique=True,
        postgresql_where=sa.text("status = 'current'"),
        sqlite_where=sa.text("status = 'current'"),
    )


def downgrade() -> None:
    op.drop_index("uq_design_versions_one_current", table_name="design_versions")
    op.drop_index("ix_design_versions_technical_card_id", table_name="design_versions")
    op.drop_index(
        "ix_design_versions_sales_order_item_id",
        table_name="design_versions",
    )
    op.drop_index("ix_design_versions_status", table_name="design_versions")
    op.drop_index(
        "ix_design_versions_design_project_id",
        table_name="design_versions",
    )
    op.drop_table("design_versions")
    op.drop_index("ix_design_projects_status", table_name="design_projects")
    op.drop_index("ix_design_projects_sales_order_id", table_name="design_projects")
    op.drop_table("design_projects")
