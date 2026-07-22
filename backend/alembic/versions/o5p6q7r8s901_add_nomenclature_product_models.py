"""add nomenclature product models whitelist

Revision ID: o5p6q7r8s901
Revises: n4o5p6q7r890
"""

import sqlalchemy as sa
from alembic import op

revision = "o5p6q7r8s901"
down_revision = "n4o5p6q7r890"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "nomenclature_product_models",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("nomenclature_id", sa.Integer(), nullable=False),
        sa.Column("product_model_id", sa.Integer(), nullable=False),
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
            name="ck_nomenclature_product_models_sort_order",
        ),
        sa.ForeignKeyConstraint(
            ["nomenclature_id"],
            ["nomenclatures.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["product_model_id"],
            ["product_models.id"],
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "nomenclature_id",
            "product_model_id",
            name="uq_nomenclature_product_models_pair",
        ),
    )
    op.create_index(
        "ix_nomenclature_product_models_nomenclature_id",
        "nomenclature_product_models",
        ["nomenclature_id"],
    )
    op.create_index(
        "ix_nomenclature_product_models_product_model_id",
        "nomenclature_product_models",
        ["product_model_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_nomenclature_product_models_product_model_id",
        table_name="nomenclature_product_models",
    )
    op.drop_index(
        "ix_nomenclature_product_models_nomenclature_id",
        table_name="nomenclature_product_models",
    )
    op.drop_table("nomenclature_product_models")
