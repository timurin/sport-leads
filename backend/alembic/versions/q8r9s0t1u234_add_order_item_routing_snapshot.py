"""Add order-item routing template snapshot columns.

Revision ID: q8r9s0t1u234
Revises: p7q8r9s0t123
Roadmap: 3.2.7.2 / SL-ORDER-ITEM-MODEL-ASSEMBLY-v1 §4.5
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "q8r9s0t1u234"
down_revision = "p7q8r9s0t123"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "sales_order_items",
        sa.Column("routing_template_id", sa.Integer(), nullable=True),
    )
    op.add_column(
        "sales_order_items",
        sa.Column("routing_template_name", sa.String(length=255), nullable=True),
    )
    op.create_index(
        "ix_sales_order_items_routing_template_id",
        "sales_order_items",
        ["routing_template_id"],
    )
    op.create_foreign_key(
        "fk_sales_order_items_routing_template_id",
        "sales_order_items",
        "shop_routing_templates",
        ["routing_template_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_sales_order_items_routing_template_id",
        "sales_order_items",
        type_="foreignkey",
    )
    op.drop_index(
        "ix_sales_order_items_routing_template_id",
        table_name="sales_order_items",
    )
    op.drop_column("sales_order_items", "routing_template_name")
    op.drop_column("sales_order_items", "routing_template_id")
