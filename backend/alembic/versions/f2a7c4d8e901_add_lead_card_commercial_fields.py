"""add lead card commercial fields

Revision ID: f2a7c4d8e901
Revises: e4b8a2c91d7f
Create Date: 2026-07-18 21:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = "f2a7c4d8e901"
down_revision: str | None = "e4b8a2c91d7f"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("leads", sa.Column("direction", sa.String(length=150), nullable=True))
    op.add_column("leads", sa.Column("product_type", sa.String(length=150), nullable=True))
    op.add_column("leads", sa.Column("kit_quantity", sa.Integer(), nullable=True))
    op.add_column("leads", sa.Column("size_comment", sa.Text(), nullable=True))
    op.add_column("leads", sa.Column("preliminary_budget", sa.Numeric(14, 2), nullable=True))
    op.add_column("leads", sa.Column("discount_percent", sa.Numeric(5, 2), nullable=True))
    op.add_column("leads", sa.Column("probability", sa.Numeric(5, 2), nullable=True))
    op.add_column("leads", sa.Column("planned_order_date", sa.Date(), nullable=True))
    op.add_column("leads", sa.Column("event_date", sa.Date(), nullable=True))
    op.add_column("leads", sa.Column("delivery_city", sa.String(length=150), nullable=True))
    op.add_column("leads", sa.Column("delivery_address", sa.String(length=500), nullable=True))
    op.add_column("leads", sa.Column("delivery_method", sa.String(length=150), nullable=True))
    op.add_column("leads", sa.Column("delivery_comment", sa.Text(), nullable=True))
    op.add_column("leads", sa.Column("campaign", sa.String(length=255), nullable=True))
    op.add_column("leads", sa.Column("utm_description", sa.Text(), nullable=True))
    op.add_column("leads", sa.Column("priority", sa.String(length=20), nullable=True))
    op.execute(
        "UPDATE leads SET delivery_city = city "
        "WHERE delivery_city IS NULL AND city IS NOT NULL"
    )


def downgrade() -> None:
    op.drop_column("leads", "priority")
    op.drop_column("leads", "utm_description")
    op.drop_column("leads", "campaign")
    op.drop_column("leads", "delivery_comment")
    op.drop_column("leads", "delivery_method")
    op.drop_column("leads", "delivery_address")
    op.drop_column("leads", "delivery_city")
    op.drop_column("leads", "event_date")
    op.drop_column("leads", "planned_order_date")
    op.drop_column("leads", "probability")
    op.drop_column("leads", "discount_percent")
    op.drop_column("leads", "preliminary_budget")
    op.drop_column("leads", "size_comment")
    op.drop_column("leads", "kit_quantity")
    op.drop_column("leads", "product_type")
    op.drop_column("leads", "direction")
