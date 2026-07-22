"""add size_grid_id on product models

Revision ID: w3x4y5z6a789
Revises: v2w3x4y5z678
"""

import sqlalchemy as sa
from alembic import op


revision = "w3x4y5z6a789"
down_revision = "v2w3x4y5z678"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "product_models",
        sa.Column("size_grid_id", sa.Integer(), nullable=True),
    )
    op.create_index(
        "ix_product_models_size_grid_id",
        "product_models",
        ["size_grid_id"],
    )
    op.create_foreign_key(
        "fk_product_models_size_grid_id",
        "product_models",
        "size_grids",
        ["size_grid_id"],
        ["id"],
        ondelete="RESTRICT",
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_product_models_size_grid_id",
        "product_models",
        type_="foreignkey",
    )
    op.drop_index("ix_product_models_size_grid_id", table_name="product_models")
    op.drop_column("product_models", "size_grid_id")
