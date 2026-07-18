"""add order item dimensions and personalization

Revision ID: e0f1a2b3c456
Revises: d9e0f1a2b345
"""

import sqlalchemy as sa
from alembic import op


revision = "e0f1a2b3c456"
down_revision = "d9e0f1a2b345"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("sales_order_items", sa.Column("size_range", sa.String(length=255), nullable=True))
    op.add_column("sales_order_items", sa.Column("personalization", sa.String(length=500), nullable=True))


def downgrade() -> None:
    op.drop_column("sales_order_items", "personalization")
    op.drop_column("sales_order_items", "size_range")
