"""Add product model folders + model folder_id/sort_order (6.1.18).

Revision ID: c6d7e8f9a012
Revises: b5c6d7e8f901
Roadmap: 6.1.18
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "c6d7e8f9a012"
down_revision = "b5c6d7e8f901"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "product_model_folders",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "parent_id",
            sa.Integer(),
            sa.ForeignKey("product_model_folders.id", ondelete="RESTRICT"),
            nullable=True,
        ),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column(
            "sort_order",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.CheckConstraint(
            "sort_order >= 0",
            name="ck_product_model_folders_sort_order_nonnegative",
        ),
    )
    op.create_index(
        "ix_product_model_folders_parent_id",
        "product_model_folders",
        ["parent_id"],
    )
    op.create_index(
        "ix_product_model_folders_name",
        "product_model_folders",
        ["name"],
    )

    op.add_column(
        "product_models",
        sa.Column(
            "folder_id",
            sa.Integer(),
            sa.ForeignKey("product_model_folders.id", ondelete="RESTRICT"),
            nullable=True,
        ),
    )
    op.add_column(
        "product_models",
        sa.Column(
            "sort_order",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
    )
    op.create_index(
        "ix_product_models_folder_id",
        "product_models",
        ["folder_id"],
    )
    op.create_check_constraint(
        "ck_product_models_sort_order_nonnegative",
        "product_models",
        "sort_order >= 0",
    )

    # Backfill sibling order for existing models at root by lower(article), id.
    op.execute(
        """
        WITH ordered AS (
            SELECT
                id,
                (ROW_NUMBER() OVER (ORDER BY lower(article), id) - 1)::integer AS rn
            FROM product_models
        )
        UPDATE product_models AS pm
        SET sort_order = ordered.rn
        FROM ordered
        WHERE pm.id = ordered.id
        """
    )


def downgrade() -> None:
    op.drop_constraint(
        "ck_product_models_sort_order_nonnegative",
        "product_models",
        type_="check",
    )
    op.drop_index("ix_product_models_folder_id", table_name="product_models")
    op.drop_column("product_models", "sort_order")
    op.drop_column("product_models", "folder_id")
    op.drop_index("ix_product_model_folders_name", table_name="product_model_folders")
    op.drop_index(
        "ix_product_model_folders_parent_id",
        table_name="product_model_folders",
    )
    op.drop_table("product_model_folders")
