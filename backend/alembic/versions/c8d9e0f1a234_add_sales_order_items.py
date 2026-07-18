"""add sales order items

Revision ID: c8d9e0f1a234
Revises: b7c8d9e0f123
"""

from alembic import op
import sqlalchemy as sa


revision = "c8d9e0f1a234"
down_revision = "b7c8d9e0f123"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "sales_order_items",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("order_id", sa.Integer(), nullable=False),
        sa.Column("material_id", sa.Integer(), nullable=True),
        sa.Column("position", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("unit", sa.String(length=30), nullable=False, server_default="шт"),
        sa.Column("quantity", sa.Numeric(14, 3), nullable=False),
        sa.Column("unit_price", sa.Numeric(14, 2), nullable=False),
        sa.Column("line_total", sa.Numeric(14, 2), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("quantity > 0", name="ck_sales_order_items_quantity_positive"),
        sa.CheckConstraint("unit_price >= 0", name="ck_sales_order_items_unit_price_nonnegative"),
        sa.CheckConstraint("line_total >= 0", name="ck_sales_order_items_line_total_nonnegative"),
        sa.ForeignKeyConstraint(["order_id"], ["sales_orders.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["material_id"], ["materials.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_sales_order_items_order_id", "sales_order_items", ["order_id"])
    op.create_index("ix_sales_order_items_material_id", "sales_order_items", ["material_id"])


def downgrade() -> None:
    op.drop_index("ix_sales_order_items_material_id", table_name="sales_order_items")
    op.drop_index("ix_sales_order_items_order_id", table_name="sales_order_items")
    op.drop_table("sales_order_items")
