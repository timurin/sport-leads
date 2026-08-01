"""add sales_orders payment and material reserve markers

Revision ID: i6d7e8f9a012
Revises: h5c6d7e8f901
Create Date: 2026-07-31
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "i6d7e8f9a012"
down_revision = "h5c6d7e8f901"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "sales_orders",
        sa.Column(
            "payment_status",
            sa.String(length=20),
            nullable=False,
            server_default="unpaid",
        ),
    )
    op.add_column(
        "sales_orders",
        sa.Column(
            "paid_amount",
            sa.Numeric(14, 2),
            nullable=False,
            server_default="0",
        ),
    )
    op.add_column(
        "sales_orders",
        sa.Column(
            "material_reserve_status",
            sa.String(length=20),
            nullable=False,
            server_default="not_required",
        ),
    )
    op.create_index(
        "ix_sales_orders_payment_status",
        "sales_orders",
        ["payment_status"],
    )
    op.create_index(
        "ix_sales_orders_material_reserve_status",
        "sales_orders",
        ["material_reserve_status"],
    )
    op.create_check_constraint(
        "ck_sales_orders_paid_amount_nonnegative",
        "sales_orders",
        "paid_amount >= 0",
    )


def downgrade() -> None:
    op.drop_constraint(
        "ck_sales_orders_paid_amount_nonnegative",
        "sales_orders",
        type_="check",
    )
    op.drop_index(
        "ix_sales_orders_material_reserve_status",
        table_name="sales_orders",
    )
    op.drop_index("ix_sales_orders_payment_status", table_name="sales_orders")
    op.drop_column("sales_orders", "material_reserve_status")
    op.drop_column("sales_orders", "paid_amount")
    op.drop_column("sales_orders", "payment_status")
