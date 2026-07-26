"""add shop routings and tech operations (Stage 8.1.2 / 8.1.3 / ADR-017)

Revision ID: l3m4n5o6p789
Revises: k2l3m4n5o678
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "l3m4n5o6p789"
down_revision = "k2l3m4n5o678"
branch_labels = None
depends_on = None

SEED_TECH_OPS = [
    ("Сублимационная печать", "sublimation", "linear_meters", 10),
    ("Термоперенос", "heat_transfer", "linear_meters", 20),
    ("Пошив", "sewing", "pieces", 30),
    ("ВТО", "wto", "pieces", 40),
    ("Упаковка", "packaging", "pieces", 50),
]


def upgrade() -> None:
    op.create_table(
        "tech_operations",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("code", sa.String(length=64), nullable=False),
        sa.Column("volume_unit", sa.String(length=20), nullable=False),
        sa.Column(
            "is_active",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
        sa.Column(
            "sort_order",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
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
            "volume_unit IN ('linear_meters', 'pieces')",
            name="ck_tech_operations_volume_unit",
        ),
        sa.CheckConstraint(
            "sort_order >= 0",
            name="ck_tech_operations_sort_order_nonnegative",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name", name="uq_tech_operations_name"),
        sa.UniqueConstraint("code", name="uq_tech_operations_code"),
    )
    op.create_index("ix_tech_operations_name", "tech_operations", ["name"])
    op.create_index("ix_tech_operations_code", "tech_operations", ["code"])
    op.create_index("ix_tech_operations_is_active", "tech_operations", ["is_active"])

    tech_ops = sa.table(
        "tech_operations",
        sa.column("name", sa.String),
        sa.column("code", sa.String),
        sa.column("volume_unit", sa.String),
        sa.column("is_active", sa.Boolean),
        sa.column("sort_order", sa.Integer),
    )
    op.bulk_insert(
        tech_ops,
        [
            {
                "name": name,
                "code": code,
                "volume_unit": unit,
                "is_active": True,
                "sort_order": sort_order,
            }
            for name, code, unit, sort_order in SEED_TECH_OPS
        ],
    )

    op.create_table(
        "work_centers",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("code", sa.String(length=64), nullable=False),
        sa.Column(
            "is_active",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
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
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name", name="uq_work_centers_name"),
        sa.UniqueConstraint("code", name="uq_work_centers_code"),
    )
    op.create_index("ix_work_centers_name", "work_centers", ["name"])
    op.create_index("ix_work_centers_code", "work_centers", ["code"])
    op.create_index("ix_work_centers_is_active", "work_centers", ["is_active"])

    op.create_table(
        "shop_routing_templates",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("code", sa.String(length=64), nullable=True),
        sa.Column(
            "is_active",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
        sa.Column("notes", sa.Text(), nullable=True),
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
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name", name="uq_shop_routing_templates_name"),
        sa.UniqueConstraint("code", name="uq_shop_routing_templates_code"),
    )
    op.create_index(
        "ix_shop_routing_templates_name", "shop_routing_templates", ["name"]
    )
    op.create_index(
        "ix_shop_routing_templates_code", "shop_routing_templates", ["code"]
    )
    op.create_index(
        "ix_shop_routing_templates_is_active",
        "shop_routing_templates",
        ["is_active"],
    )

    op.create_table(
        "shop_routing_stage_lines",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("routing_template_id", sa.Integer(), nullable=False),
        sa.Column("stage_order", sa.Integer(), nullable=False),
        sa.Column("stage_label", sa.String(length=255), nullable=False),
        sa.Column("tech_operation_id", sa.Integer(), nullable=True),
        sa.Column("work_center_id", sa.Integer(), nullable=True),
        sa.Column(
            "is_quality_checkpoint",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
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
            "stage_order >= 1",
            name="ck_shop_routing_stage_lines_stage_order",
        ),
        sa.ForeignKeyConstraint(
            ["routing_template_id"],
            ["shop_routing_templates.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["tech_operation_id"],
            ["tech_operations.id"],
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["work_center_id"],
            ["work_centers.id"],
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "routing_template_id",
            "stage_order",
            name="uq_shop_routing_stage_lines_template_order",
        ),
    )
    op.create_index(
        "ix_shop_routing_stage_lines_routing_template_id",
        "shop_routing_stage_lines",
        ["routing_template_id"],
    )
    op.create_index(
        "ix_shop_routing_stage_lines_tech_operation_id",
        "shop_routing_stage_lines",
        ["tech_operation_id"],
    )
    op.create_index(
        "ix_shop_routing_stage_lines_work_center_id",
        "shop_routing_stage_lines",
        ["work_center_id"],
    )

    op.add_column(
        "product_models",
        sa.Column("default_routing_template_id", sa.Integer(), nullable=True),
    )
    op.create_index(
        "ix_product_models_default_routing_template_id",
        "product_models",
        ["default_routing_template_id"],
    )
    op.create_foreign_key(
        "fk_product_models_default_routing_template_id",
        "product_models",
        "shop_routing_templates",
        ["default_routing_template_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_product_models_default_routing_template_id",
        "product_models",
        type_="foreignkey",
    )
    op.drop_index(
        "ix_product_models_default_routing_template_id",
        table_name="product_models",
    )
    op.drop_column("product_models", "default_routing_template_id")

    op.drop_index(
        "ix_shop_routing_stage_lines_work_center_id",
        table_name="shop_routing_stage_lines",
    )
    op.drop_index(
        "ix_shop_routing_stage_lines_tech_operation_id",
        table_name="shop_routing_stage_lines",
    )
    op.drop_index(
        "ix_shop_routing_stage_lines_routing_template_id",
        table_name="shop_routing_stage_lines",
    )
    op.drop_table("shop_routing_stage_lines")

    op.drop_index(
        "ix_shop_routing_templates_is_active",
        table_name="shop_routing_templates",
    )
    op.drop_index(
        "ix_shop_routing_templates_code", table_name="shop_routing_templates"
    )
    op.drop_index(
        "ix_shop_routing_templates_name", table_name="shop_routing_templates"
    )
    op.drop_table("shop_routing_templates")

    op.drop_index("ix_work_centers_is_active", table_name="work_centers")
    op.drop_index("ix_work_centers_code", table_name="work_centers")
    op.drop_index("ix_work_centers_name", table_name="work_centers")
    op.drop_table("work_centers")

    op.drop_index("ix_tech_operations_is_active", table_name="tech_operations")
    op.drop_index("ix_tech_operations_code", table_name="tech_operations")
    op.drop_index("ix_tech_operations_name", table_name="tech_operations")
    op.drop_table("tech_operations")
