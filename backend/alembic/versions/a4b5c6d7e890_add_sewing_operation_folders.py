"""Add sewing operation folders + op folder_id/sort_order (6.3.11).

Revision ID: a4b5c6d7e890
Revises: z3a4b5c6d789
Roadmap: 6.3.11.2
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "a4b5c6d7e890"
down_revision = "a4b5c6d7e891"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "sewing_operation_folders",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "parent_id",
            sa.Integer(),
            sa.ForeignKey("sewing_operation_folders.id", ondelete="RESTRICT"),
            nullable=True,
        ),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column(
            "sort_order",
            sa.Integer(),
            nullable=False,
            server_default="0",
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
        sa.CheckConstraint(
            "sort_order >= 0",
            name="ck_sewing_operation_folders_sort_order_nonnegative",
        ),
    )
    op.create_index(
        "ix_sewing_operation_folders_parent_id",
        "sewing_operation_folders",
        ["parent_id"],
    )
    op.create_index(
        "ix_sewing_operation_folders_name",
        "sewing_operation_folders",
        ["name"],
    )

    op.add_column(
        "sewing_operations",
        sa.Column(
            "folder_id",
            sa.Integer(),
            sa.ForeignKey("sewing_operation_folders.id", ondelete="RESTRICT"),
            nullable=True,
        ),
    )
    op.add_column(
        "sewing_operations",
        sa.Column(
            "sort_order",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
    )
    op.create_index(
        "ix_sewing_operations_folder_id",
        "sewing_operations",
        ["folder_id"],
    )
    op.create_check_constraint(
        "ck_sewing_operations_sort_order_nonnegative",
        "sewing_operations",
        "sort_order >= 0",
    )

    # Backfill sibling order for existing ops at root by lower(name), id.
    op.execute(
        """
        WITH ordered AS (
            SELECT
                id,
                (ROW_NUMBER() OVER (ORDER BY lower(name), id) - 1)::integer AS rn
            FROM sewing_operations
        )
        UPDATE sewing_operations AS so
        SET sort_order = ordered.rn
        FROM ordered
        WHERE so.id = ordered.id
        """
    )


def downgrade() -> None:
    op.drop_constraint(
        "ck_sewing_operations_sort_order_nonnegative",
        "sewing_operations",
        type_="check",
    )
    op.drop_index("ix_sewing_operations_folder_id", table_name="sewing_operations")
    op.drop_column("sewing_operations", "sort_order")
    op.drop_column("sewing_operations", "folder_id")
    op.drop_index("ix_sewing_operation_folders_name", table_name="sewing_operation_folders")
    op.drop_index(
        "ix_sewing_operation_folders_parent_id",
        table_name="sewing_operation_folders",
    )
    op.drop_table("sewing_operation_folders")
