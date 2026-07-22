"""add product model cover image url

Revision ID: l2m3n4o5p678
Revises: k1l2m3n4o567
"""

import sqlalchemy as sa
from alembic import op

revision = "l2m3n4o5p678"
down_revision = "k1l2m3n4o567"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "product_models",
        sa.Column("cover_image_url", sa.String(length=500), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("product_models", "cover_image_url")
