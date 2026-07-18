"""add order item color

Revision ID: f1a2b3c4d567
Revises: e0f1a2b3c456
"""

import sqlalchemy as sa
from alembic import op


revision = "f1a2b3c4d567"
down_revision = "e0f1a2b3c456"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("sales_order_items", sa.Column("color", sa.String(length=100), nullable=True))


def downgrade() -> None:
    op.drop_column("sales_order_items", "color")
