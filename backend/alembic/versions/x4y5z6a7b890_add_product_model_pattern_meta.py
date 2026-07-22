"""add product model pattern meta fields

Revision ID: x4y5z6a7b890
Revises: w3x4y5z6a789
"""

import sqlalchemy as sa
from alembic import op


revision = "x4y5z6a7b890"
down_revision = "w3x4y5z6a789"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "product_models",
        sa.Column("patterns_path", sa.String(length=1000), nullable=True),
    )
    op.add_column(
        "product_models",
        sa.Column("constructor_name", sa.String(length=255), nullable=True),
    )
    op.add_column(
        "product_models",
        sa.Column("patterns_created_on", sa.Date(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("product_models", "patterns_created_on")
    op.drop_column("product_models", "constructor_name")
    op.drop_column("product_models", "patterns_path")
