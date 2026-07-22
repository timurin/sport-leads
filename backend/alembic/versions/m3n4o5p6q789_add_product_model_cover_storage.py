"""add product model cover storage fields

Revision ID: m3n4o5p6q789
Revises: l2m3n4o5p678
"""

import sqlalchemy as sa
from alembic import op

revision = "m3n4o5p6q789"
down_revision = "l2m3n4o5p678"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "product_models",
        sa.Column("cover_storage_key", sa.String(length=500), nullable=True),
    )
    op.add_column(
        "product_models",
        sa.Column("cover_mime_type", sa.String(length=100), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("product_models", "cover_mime_type")
    op.drop_column("product_models", "cover_storage_key")
