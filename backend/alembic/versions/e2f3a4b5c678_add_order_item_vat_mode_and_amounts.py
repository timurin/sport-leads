"""add order-item VAT mode and vat_amount fields

Revision ID: e2f3a4b5c678
Revises: d1e2f3a4b567
Create Date: 2026-07-31
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "e2f3a4b5c678"
down_revision = "d1e2f3a4b567"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "sales_order_items",
        sa.Column(
            "price_includes_vat",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
    )
    op.add_column(
        "sales_order_items",
        sa.Column(
            "vat_amount",
            sa.Numeric(14, 2),
            nullable=False,
            server_default="0.00",
        ),
    )
    op.create_check_constraint(
        "ck_sales_order_items_vat_amount_nonnegative",
        "sales_order_items",
        "vat_amount >= 0",
    )

    op.add_column(
        "sales_orders",
        sa.Column(
            "vat_amount",
            sa.Numeric(14, 2),
            nullable=False,
            server_default="0.00",
        ),
    )
    op.create_check_constraint(
        "ck_sales_orders_vat_amount_nonnegative",
        "sales_orders",
        "vat_amount >= 0",
    )


def downgrade() -> None:
    op.drop_constraint("ck_sales_orders_vat_amount_nonnegative", "sales_orders", type_="check")
    op.drop_column("sales_orders", "vat_amount")
    op.drop_constraint(
        "ck_sales_order_items_vat_amount_nonnegative",
        "sales_order_items",
        type_="check",
    )
    op.drop_column("sales_order_items", "vat_amount")
    op.drop_column("sales_order_items", "price_includes_vat")
