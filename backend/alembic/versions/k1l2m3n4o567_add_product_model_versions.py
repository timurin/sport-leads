"""add product model versions

Revision ID: k1l2m3n4o567
Revises: j0k1l2m3n456
"""

import sqlalchemy as sa
from alembic import op

revision = "k1l2m3n4o567"
down_revision = "j0k1l2m3n456"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "product_model_versions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("product_model_id", sa.Integer(), nullable=False),
        sa.Column("version_number", sa.Integer(), nullable=False),
        sa.Column("label", sa.String(length=100), nullable=True),
        sa.Column("state", sa.String(length=20), nullable=False, server_default="draft"),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
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
            "state IN ('draft', 'published', 'archived')",
            name="ck_product_model_versions_state",
        ),
        sa.CheckConstraint(
            "version_number >= 1",
            name="ck_product_model_versions_number",
        ),
        sa.ForeignKeyConstraint(
            ["product_model_id"],
            ["product_models.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "product_model_id",
            "version_number",
            name="uq_product_model_versions_model_number",
        ),
    )
    op.create_index(
        "ix_product_model_versions_product_model_id",
        "product_model_versions",
        ["product_model_id"],
    )
    op.create_index(
        "ix_product_model_versions_state",
        "product_model_versions",
        ["state"],
    )


def downgrade() -> None:
    op.drop_index("ix_product_model_versions_state", table_name="product_model_versions")
    op.drop_index(
        "ix_product_model_versions_product_model_id",
        table_name="product_model_versions",
    )
    op.drop_table("product_model_versions")
