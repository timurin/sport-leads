"""add folder default sewing operation template

Revision ID: d7e8f9a0b123
Revises: c6d7e8f9a012
Create Date: 2026-08-02
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "d7e8f9a0b123"
down_revision = "c6d7e8f9a012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "product_model_folders",
        sa.Column(
            "default_sewing_operation_template_id",
            sa.Integer(),
            nullable=True,
        ),
    )
    op.create_foreign_key(
        "fk_product_model_folders_default_sewing_template",
        "product_model_folders",
        "sewing_operation_templates",
        ["default_sewing_operation_template_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        "ix_product_model_folders_default_sewing_template_id",
        "product_model_folders",
        ["default_sewing_operation_template_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_product_model_folders_default_sewing_template_id",
        table_name="product_model_folders",
    )
    op.drop_constraint(
        "fk_product_model_folders_default_sewing_template",
        "product_model_folders",
        type_="foreignkey",
    )
    op.drop_column(
        "product_model_folders",
        "default_sewing_operation_template_id",
    )
