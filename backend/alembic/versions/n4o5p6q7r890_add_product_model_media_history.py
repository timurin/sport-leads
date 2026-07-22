"""add product model media gallery and history log

Revision ID: n4o5p6q7r890
Revises: m3n4o5p6q789
"""

import sqlalchemy as sa
from alembic import op

revision = "n4o5p6q7r890"
down_revision = "m3n4o5p6q789"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "product_model_media",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("product_model_id", sa.Integer(), nullable=False),
        sa.Column("filename", sa.String(length=255), nullable=False),
        sa.Column("storage_key", sa.String(length=500), nullable=False),
        sa.Column("mime_type", sa.String(length=100), nullable=False),
        sa.Column("file_size", sa.Integer(), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_primary", sa.Boolean(), nullable=False, server_default=sa.false()),
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
        sa.CheckConstraint("file_size > 0", name="ck_product_model_media_file_size"),
        sa.CheckConstraint("sort_order >= 0", name="ck_product_model_media_sort_order"),
        sa.ForeignKeyConstraint(["product_model_id"], ["product_models.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("storage_key", name="uq_product_model_media_storage_key"),
    )
    op.create_index(
        "ix_product_model_media_product_model_id",
        "product_model_media",
        ["product_model_id"],
    )
    op.create_index(
        "ix_product_model_media_is_primary",
        "product_model_media",
        ["is_primary"],
    )

    op.create_table(
        "product_model_history",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("product_model_id", sa.Integer(), nullable=False),
        sa.Column("actor", sa.String(length=255), nullable=False, server_default="Система"),
        sa.Column("action", sa.String(length=500), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["product_model_id"], ["product_models.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_product_model_history_product_model_id",
        "product_model_history",
        ["product_model_id"],
    )
    op.create_index(
        "ix_product_model_history_created_at",
        "product_model_history",
        ["created_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_product_model_history_created_at", table_name="product_model_history")
    op.drop_index(
        "ix_product_model_history_product_model_id",
        table_name="product_model_history",
    )
    op.drop_table("product_model_history")
    op.drop_index("ix_product_model_media_is_primary", table_name="product_model_media")
    op.drop_index(
        "ix_product_model_media_product_model_id",
        table_name="product_model_media",
    )
    op.drop_table("product_model_media")
