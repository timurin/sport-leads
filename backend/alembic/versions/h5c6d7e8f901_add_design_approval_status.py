"""add sales_orders.design_approval_status

Revision ID: h5c6d7e8f901
Revises: g4b5c6d7e890
Create Date: 2026-07-31
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "h5c6d7e8f901"
down_revision = "g4b5c6d7e890"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "sales_orders",
        sa.Column(
            "design_approval_status",
            sa.String(length=20),
            nullable=False,
            server_default="not_required",
        ),
    )
    op.create_index(
        "ix_sales_orders_design_approval_status",
        "sales_orders",
        ["design_approval_status"],
    )


def downgrade() -> None:
    op.drop_index("ix_sales_orders_design_approval_status", table_name="sales_orders")
    op.drop_column("sales_orders", "design_approval_status")
