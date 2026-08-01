"""Add product model routing whitelist links and operation norms.

Revision ID: p7q8r9s0t123
Revises: o6p7q8r9s012

Stage 6.1.17.2: ProductModelRoutingLink + ProductModelOperationNorm.
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "p7q8r9s0t123"
down_revision = "o6p7q8r9s012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "product_model_routing_links",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("product_model_id", sa.Integer(), nullable=False),
        sa.Column("shop_routing_template_id", sa.Integer(), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
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
            name="ck_product_model_routing_links_sort_order",
        ),
        sa.ForeignKeyConstraint(
            ["product_model_id"],
            ["product_models.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["shop_routing_template_id"],
            ["shop_routing_templates.id"],
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "product_model_id",
            "shop_routing_template_id",
            name="uq_product_model_routing_links_model_template",
        ),
    )
    op.create_index(
        "ix_product_model_routing_links_product_model_id",
        "product_model_routing_links",
        ["product_model_id"],
    )
    op.create_index(
        "ix_product_model_routing_links_shop_routing_template_id",
        "product_model_routing_links",
        ["shop_routing_template_id"],
    )
    op.create_index(
        "ix_product_model_routing_links_is_active",
        "product_model_routing_links",
        ["is_active"],
    )

    op.create_table(
        "product_model_operation_norms",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("product_model_routing_link_id", sa.Integer(), nullable=False),
        sa.Column("production_stage_id", sa.Integer(), nullable=True),
        sa.Column("tech_operation_id", sa.Integer(), nullable=True),
        sa.Column("norm_qty_per_item", sa.Numeric(14, 3), nullable=False, server_default="0"),
        sa.Column("unit", sa.String(length=64), nullable=False),
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
            "norm_qty_per_item >= 0",
            name="ck_product_model_operation_norms_qty_nonnegative",
        ),
        sa.CheckConstraint(
            "production_stage_id IS NOT NULL OR tech_operation_id IS NOT NULL",
            name="ck_product_model_operation_norms_stage_or_op",
        ),
        sa.ForeignKeyConstraint(
            ["product_model_routing_link_id"],
            ["product_model_routing_links.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["production_stage_id"],
            ["production_stages.id"],
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["tech_operation_id"],
            ["tech_operations.id"],
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_product_model_operation_norms_link_id",
        "product_model_operation_norms",
        ["product_model_routing_link_id"],
    )
    op.create_index(
        "ix_product_model_operation_norms_production_stage_id",
        "product_model_operation_norms",
        ["production_stage_id"],
    )
    op.create_index(
        "ix_product_model_operation_norms_tech_operation_id",
        "product_model_operation_norms",
        ["tech_operation_id"],
    )
    # Locked uniqueness (`6.1.17.2`): one norm per link+stage when op unset;
    # one norm per link+stage+op when op set. Service also resolves stage from op.
    op.create_index(
        "uq_product_model_operation_norms_link_stage_no_op",
        "product_model_operation_norms",
        ["product_model_routing_link_id", "production_stage_id"],
        unique=True,
        postgresql_where=sa.text("tech_operation_id IS NULL"),
    )
    op.create_index(
        "uq_product_model_operation_norms_link_stage_op",
        "product_model_operation_norms",
        ["product_model_routing_link_id", "production_stage_id", "tech_operation_id"],
        unique=True,
        postgresql_where=sa.text("tech_operation_id IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index(
        "uq_product_model_operation_norms_link_stage_op",
        table_name="product_model_operation_norms",
    )
    op.drop_index(
        "uq_product_model_operation_norms_link_stage_no_op",
        table_name="product_model_operation_norms",
    )
    op.drop_index(
        "ix_product_model_operation_norms_tech_operation_id",
        table_name="product_model_operation_norms",
    )
    op.drop_index(
        "ix_product_model_operation_norms_production_stage_id",
        table_name="product_model_operation_norms",
    )
    op.drop_index(
        "ix_product_model_operation_norms_link_id",
        table_name="product_model_operation_norms",
    )
    op.drop_table("product_model_operation_norms")

    op.drop_index(
        "ix_product_model_routing_links_is_active",
        table_name="product_model_routing_links",
    )
    op.drop_index(
        "ix_product_model_routing_links_shop_routing_template_id",
        table_name="product_model_routing_links",
    )
    op.drop_index(
        "ix_product_model_routing_links_product_model_id",
        table_name="product_model_routing_links",
    )
    op.drop_table("product_model_routing_links")
