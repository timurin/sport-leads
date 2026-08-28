"""Add sales_orders.tech_cards_planned_count (Stage 28.1.1).

Revision ID: h7i8j9k0l123
Revises: g6h7i8j9k012
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "h7i8j9k0l123"
down_revision = "g6h7i8j9k012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "sales_orders",
        sa.Column("tech_cards_planned_count", sa.Integer(), nullable=True),
    )
    op.create_check_constraint(
        "ck_sales_orders_tech_cards_planned_count",
        "sales_orders",
        "tech_cards_planned_count IS NULL OR tech_cards_planned_count >= 1",
    )


def downgrade() -> None:
    op.drop_constraint(
        "ck_sales_orders_tech_cards_planned_count",
        "sales_orders",
        type_="check",
    )
    op.drop_column("sales_orders", "tech_cards_planned_count")
