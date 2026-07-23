"""add product_type_id on product models

Revision ID: a1b2c3d4e515
Revises: z6a7b8c9d012
"""

import sqlalchemy as sa
from alembic import op


revision = "a1b2c3d4e515"
down_revision = "z6a7b8c9d012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "product_models",
        sa.Column("product_type_id", sa.Integer(), nullable=True),
    )
    op.create_index(
        "ix_product_models_product_type_id",
        "product_models",
        ["product_type_id"],
    )
    op.create_foreign_key(
        "fk_product_models_product_type_id",
        "product_models",
        "product_types",
        ["product_type_id"],
        ["id"],
        ondelete="RESTRICT",
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_product_models_product_type_id",
        "product_models",
        type_="foreignkey",
    )
    op.drop_index("ix_product_models_product_type_id", table_name="product_models")
    op.drop_column("product_models", "product_type_id")
