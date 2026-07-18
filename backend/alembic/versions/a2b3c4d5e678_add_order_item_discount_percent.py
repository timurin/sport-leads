"""add order item discount percent

Revision ID: a2b3c4d5e678
Revises: f1a2b3c4d567
"""

import sqlalchemy as sa
from alembic import op

revision = "a2b3c4d5e678"
down_revision = "f1a2b3c4d567"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("sales_order_items", sa.Column("discount_percent", sa.Numeric(5, 2), nullable=True))
    op.add_column("sales_order_items", sa.Column("discount_amount", sa.Numeric(14, 2), nullable=False, server_default=sa.text("0.00")))
    op.create_check_constraint("ck_sales_order_items_discount_percent_range", "sales_order_items", "discount_percent IS NULL OR (discount_percent >= 0 AND discount_percent <= 100)")
    op.create_check_constraint("ck_sales_order_items_discount_amount_nonnegative", "sales_order_items", "discount_amount >= 0")
    op.alter_column("sales_order_items", "discount_amount", server_default=None)


def downgrade() -> None:
    op.drop_constraint("ck_sales_order_items_discount_amount_nonnegative", "sales_order_items", type_="check")
    op.drop_constraint("ck_sales_order_items_discount_percent_range", "sales_order_items", type_="check")
    op.drop_column("sales_order_items", "discount_amount")
    op.drop_column("sales_order_items", "discount_percent")
