"""add product models catalog core

Revision ID: j0k1l2m3n456
Revises: i9j0k1l2m345
"""

import sqlalchemy as sa
from alembic import op

revision = "j0k1l2m3n456"
down_revision = "i9j0k1l2m345"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "product_models",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("article", sa.String(length=100), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("size_type", sa.String(length=20), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="draft"),
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
            "size_type IN ('men', 'women', 'kids')",
            name="ck_product_models_size_type",
        ),
        sa.CheckConstraint(
            "status IN ('draft', 'active', 'archived')",
            name="ck_product_models_status",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("article", name="uq_product_models_article"),
    )
    op.create_index("ix_product_models_article", "product_models", ["article"])
    op.create_index("ix_product_models_name", "product_models", ["name"])
    op.create_index("ix_product_models_size_type", "product_models", ["size_type"])
    op.create_index("ix_product_models_status", "product_models", ["status"])


def downgrade() -> None:
    op.drop_index("ix_product_models_status", table_name="product_models")
    op.drop_index("ix_product_models_size_type", table_name="product_models")
    op.drop_index("ix_product_models_name", table_name="product_models")
    op.drop_index("ix_product_models_article", table_name="product_models")
    op.drop_table("product_models")
