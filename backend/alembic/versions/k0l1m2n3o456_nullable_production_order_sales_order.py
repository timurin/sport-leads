"""Nullable ProductionOrder.sales_order_id + order_group XOR (28.5.2).

Revision ID: k0l1m2n3o456
Revises: j9k0l1m2n345
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "k0l1m2n3o456"
down_revision = "j9k0l1m2n345"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "production_orders",
        sa.Column("order_group_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_production_orders_order_group_id",
        "production_orders",
        "technical_card_order_groups",
        ["order_group_id"],
        ["id"],
        ondelete="RESTRICT",
    )
    op.alter_column(
        "production_orders",
        "sales_order_id",
        existing_type=sa.Integer(),
        nullable=True,
    )
    op.create_check_constraint(
        "ck_production_orders_contour_xor",
        "production_orders",
        "("
        "(sales_order_id IS NOT NULL AND order_group_id IS NULL) OR "
        "(sales_order_id IS NULL AND order_group_id IS NOT NULL)"
        ")",
    )
    op.create_unique_constraint(
        "uq_production_orders_order_group_seq",
        "production_orders",
        ["order_group_id", "order_seq"],
    )
    op.create_index(
        "ix_production_orders_order_group_id",
        "production_orders",
        ["order_group_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_production_orders_order_group_id", table_name="production_orders")
    op.drop_constraint(
        "uq_production_orders_order_group_seq",
        "production_orders",
        type_="unique",
    )
    op.drop_constraint(
        "ck_production_orders_contour_xor",
        "production_orders",
        type_="check",
    )
    op.alter_column(
        "production_orders",
        "sales_order_id",
        existing_type=sa.Integer(),
        nullable=False,
    )
    op.drop_constraint(
        "fk_production_orders_order_group_id",
        "production_orders",
        type_="foreignkey",
    )
    op.drop_column("production_orders", "order_group_id")
