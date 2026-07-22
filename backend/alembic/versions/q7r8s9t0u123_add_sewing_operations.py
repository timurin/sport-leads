"""add sewing operations catalog

Revision ID: q7r8s9t0u123
Revises: p6q7r8s9t012
"""

import sqlalchemy as sa
from alembic import op


revision = "q7r8s9t0u123"
down_revision = "p6q7r8s9t012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "sewing_operations",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("cost", sa.Numeric(precision=14, scale=2), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint("cost >= 0", name="ck_sewing_operations_cost_non_negative"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name", name="uq_sewing_operations_name"),
    )
    op.create_index("ix_sewing_operations_name", "sewing_operations", ["name"])


def downgrade() -> None:
    op.drop_index("ix_sewing_operations_name", table_name="sewing_operations")
    op.drop_table("sewing_operations")
