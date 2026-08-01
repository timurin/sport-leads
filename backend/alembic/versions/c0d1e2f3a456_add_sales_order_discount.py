"""Add sales order level discount fields (roadmap 3.3.1.2).

Revision ID: c0d1e2f3a456
Revises: b9c0d1e2f345
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op


revision = "c0d1e2f3a456"
down_revision = "b9c0d1e2f345"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "sales_orders",
        sa.Column("discount_percent", sa.Numeric(5, 2), nullable=True),
    )
    op.add_column(
        "sales_orders",
        sa.Column(
            "discount_amount",
            sa.Numeric(14, 2),
            nullable=False,
            server_default="0",
        ),
    )
    op.create_check_constraint(
        "ck_sales_orders_discount_percent_range",
        "sales_orders",
        "discount_percent IS NULL OR (discount_percent >= 0 AND discount_percent <= 100)",
    )
    op.create_check_constraint(
        "ck_sales_orders_discount_amount_nonnegative",
        "sales_orders",
        "discount_amount >= 0",
    )


def downgrade() -> None:
    op.drop_constraint(
        "ck_sales_orders_discount_amount_nonnegative",
        "sales_orders",
        type_="check",
    )
    op.drop_constraint(
        "ck_sales_orders_discount_percent_range",
        "sales_orders",
        type_="check",
    )
    op.drop_column("sales_orders", "discount_amount")
    op.drop_column("sales_orders", "discount_percent")
