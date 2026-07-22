"""add assembly variants and operation lines

Revision ID: p6q7r8s9t012
Revises: o5p6q7r8s901
"""

import sqlalchemy as sa
from alembic import op


revision = "p6q7r8s9t012"
down_revision = "o5p6q7r8s901"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "assembly_variants",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("product_model_id", sa.Integer(), nullable=False),
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
            name="ck_assembly_variants_sort_order",
        ),
        sa.ForeignKeyConstraint(
            ["product_model_id"],
            ["product_models.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "product_model_id",
            "name",
            name="uq_assembly_variants_model_name",
        ),
    )
    op.create_index(
        "ix_assembly_variants_product_model_id",
        "assembly_variants",
        ["product_model_id"],
    )
    op.create_index(
        "ix_assembly_variants_is_active",
        "assembly_variants",
        ["is_active"],
    )

    op.create_table(
        "assembly_operation_lines",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("assembly_variant_id", sa.Integer(), nullable=False),
        sa.Column("sequence", sa.Integer(), nullable=False),
        sa.Column("operation_name", sa.String(length=255), nullable=False),
        sa.Column("cost", sa.Numeric(14, 2), nullable=False, server_default="0"),
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
            "sequence >= 1",
            name="ck_assembly_operation_lines_sequence",
        ),
        sa.CheckConstraint(
            "cost >= 0",
            name="ck_assembly_operation_lines_cost",
        ),
        sa.ForeignKeyConstraint(
            ["assembly_variant_id"],
            ["assembly_variants.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "assembly_variant_id",
            "sequence",
            name="uq_assembly_operation_lines_variant_sequence",
        ),
    )
    op.create_index(
        "ix_assembly_operation_lines_assembly_variant_id",
        "assembly_operation_lines",
        ["assembly_variant_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_assembly_operation_lines_assembly_variant_id",
        table_name="assembly_operation_lines",
    )
    op.drop_table("assembly_operation_lines")
    op.drop_index("ix_assembly_variants_is_active", table_name="assembly_variants")
    op.drop_index("ix_assembly_variants_product_model_id", table_name="assembly_variants")
    op.drop_table("assembly_variants")
