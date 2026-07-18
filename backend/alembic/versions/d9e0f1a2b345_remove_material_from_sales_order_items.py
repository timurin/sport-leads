"""remove material link from sales order items

Revision ID: d9e0f1a2b345
Revises: c8d9e0f1a234
"""

import sqlalchemy as sa
from alembic import op


revision = "d9e0f1a2b345"
down_revision = "c8d9e0f1a234"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_constraint("sales_order_items_material_id_fkey", "sales_order_items", type_="foreignkey")
    op.drop_index("ix_sales_order_items_material_id", table_name="sales_order_items")
    op.drop_column("sales_order_items", "material_id")
    op.drop_constraint("ck_sales_order_items_line_total_nonnegative", "sales_order_items", type_="check")
    op.alter_column("sales_order_items", "name", new_column_name="snapshot_name")
    op.alter_column("sales_order_items", "line_total", new_column_name="line_amount")
    op.create_check_constraint(
        "ck_sales_order_items_line_amount_nonnegative",
        "sales_order_items",
        "line_amount >= 0",
    )


def downgrade() -> None:
    op.drop_constraint("ck_sales_order_items_line_amount_nonnegative", "sales_order_items", type_="check")
    op.alter_column("sales_order_items", "line_amount", new_column_name="line_total")
    op.alter_column("sales_order_items", "snapshot_name", new_column_name="name")
    op.create_check_constraint(
        "ck_sales_order_items_line_total_nonnegative",
        "sales_order_items",
        "line_total >= 0",
    )
    op.add_column("sales_order_items", sa.Column("material_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "sales_order_items_material_id_fkey",
        "sales_order_items",
        "materials",
        ["material_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_sales_order_items_material_id", "sales_order_items", ["material_id"])
