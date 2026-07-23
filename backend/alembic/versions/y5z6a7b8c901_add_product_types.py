"""add product types catalog

Revision ID: y5z6a7b8c901
Revises: x4y5z6a7b890
"""

import sqlalchemy as sa
from alembic import op


revision = "y5z6a7b8c901"
down_revision = "x4y5z6a7b890"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "product_types",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "sort_order >= 0",
            name="ck_product_types_sort_order_nonnegative",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name", name="uq_product_types_name"),
    )
    op.create_index("ix_product_types_name", "product_types", ["name"])
    op.create_index("ix_product_types_is_active", "product_types", ["is_active"])


def downgrade() -> None:
    op.drop_index("ix_product_types_is_active", table_name="product_types")
    op.drop_index("ix_product_types_name", table_name="product_types")
    op.drop_table("product_types")
