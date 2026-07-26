"""add order-item size_type, assembly variant, and op-line snapshots

Revision ID: j1k2l3m4n567
Revises: i0j1k2l3m456
Roadmap: 3.2.5.2 / SL-ORDER-ITEM-MODEL-ASSEMBLY-v1
"""

import sqlalchemy as sa
from alembic import op


revision = "j1k2l3m4n567"
down_revision = "i0j1k2l3m456"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "sales_order_items",
        sa.Column("product_model_size_type", sa.String(length=20), nullable=True),
    )
    op.add_column(
        "sales_order_items",
        sa.Column("assembly_variant_id", sa.Integer(), nullable=True),
    )
    op.add_column(
        "sales_order_items",
        sa.Column("assembly_variant_name", sa.String(length=255), nullable=True),
    )
    op.add_column(
        "sales_order_items",
        sa.Column("assembly_variant_total_cost", sa.Numeric(14, 2), nullable=True),
    )
    op.create_check_constraint(
        "ck_sales_order_items_product_model_size_type",
        "sales_order_items",
        "product_model_size_type IS NULL OR product_model_size_type IN ('men', 'women', 'kids')",
    )
    op.create_check_constraint(
        "ck_sales_order_items_assembly_variant_total_cost",
        "sales_order_items",
        "assembly_variant_total_cost IS NULL OR assembly_variant_total_cost >= 0",
    )
    op.create_index(
        "ix_sales_order_items_assembly_variant_id",
        "sales_order_items",
        ["assembly_variant_id"],
    )
    op.create_foreign_key(
        "fk_sales_order_items_assembly_variant_id",
        "sales_order_items",
        "assembly_variants",
        ["assembly_variant_id"],
        ["id"],
        ondelete="SET NULL",
    )

    op.create_table(
        "sales_order_item_assembly_operation_snapshots",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("order_item_id", sa.Integer(), nullable=False),
        sa.Column("sequence", sa.Integer(), nullable=False),
        sa.Column("operation_name", sa.String(length=255), nullable=False),
        sa.Column("cost", sa.Numeric(14, 2), nullable=False),
        sa.Column("duration_seconds", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("sewing_operation_id", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(
            ["order_item_id"],
            ["sales_order_items.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["sewing_operation_id"],
            ["sewing_operations.id"],
            ondelete="SET NULL",
        ),
        sa.UniqueConstraint(
            "order_item_id",
            "sequence",
            name="uq_sales_order_item_assembly_op_snapshot_sequence",
        ),
        sa.CheckConstraint(
            "sequence >= 1",
            name="ck_sales_order_item_assembly_op_snapshot_sequence",
        ),
        sa.CheckConstraint(
            "cost >= 0",
            name="ck_sales_order_item_assembly_op_snapshot_cost",
        ),
        sa.CheckConstraint(
            "duration_seconds >= 0",
            name="ck_sales_order_item_assembly_op_snapshot_duration",
        ),
    )
    op.create_index(
        "ix_soi_asm_op_snap_order_item_id",
        "sales_order_item_assembly_operation_snapshots",
        ["order_item_id"],
    )
    op.create_index(
        "ix_soi_asm_op_snap_sewing_op_id",
        "sales_order_item_assembly_operation_snapshots",
        ["sewing_operation_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_soi_asm_op_snap_sewing_op_id",
        table_name="sales_order_item_assembly_operation_snapshots",
    )
    op.drop_index(
        "ix_soi_asm_op_snap_order_item_id",
        table_name="sales_order_item_assembly_operation_snapshots",
    )
    op.drop_table("sales_order_item_assembly_operation_snapshots")

    op.drop_constraint(
        "fk_sales_order_items_assembly_variant_id",
        "sales_order_items",
        type_="foreignkey",
    )
    op.drop_index("ix_sales_order_items_assembly_variant_id", table_name="sales_order_items")
    op.drop_constraint(
        "ck_sales_order_items_assembly_variant_total_cost",
        "sales_order_items",
        type_="check",
    )
    op.drop_constraint(
        "ck_sales_order_items_product_model_size_type",
        "sales_order_items",
        type_="check",
    )
    op.drop_column("sales_order_items", "assembly_variant_total_cost")
    op.drop_column("sales_order_items", "assembly_variant_name")
    op.drop_column("sales_order_items", "assembly_variant_id")
    op.drop_column("sales_order_items", "product_model_size_type")
