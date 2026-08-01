"""add sales_orders.currency_code

Revision ID: f3a4b5c6d789
Revises: e2f3a4b5c678
Create Date: 2026-07-31
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "f3a4b5c6d789"
down_revision = "e2f3a4b5c678"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "sales_orders",
        sa.Column(
            "currency_code",
            sa.String(length=3),
            nullable=False,
            server_default="RUB",
        ),
    )
    op.create_check_constraint(
        "ck_sales_orders_currency_code_iso4217_length",
        "sales_orders",
        "length(currency_code) = 3",
    )


def downgrade() -> None:
    op.drop_constraint(
        "ck_sales_orders_currency_code_iso4217_length",
        "sales_orders",
        type_="check",
    )
    op.drop_column("sales_orders", "currency_code")
