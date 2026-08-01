"""Add quantity_per_item to sewing ops and assembly/order snapshots.

Revision ID: o6p7q8r9s012
Revises: n5o6p7q8r901

Catalog field = how many times the operation runs per finished item.
Line/variant money totals use cost * quantity_per_item (default 1).
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "o6p7q8r9s012"
down_revision = "n5o6p7q8r901"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "sewing_operations",
        sa.Column(
            "quantity_per_item",
            sa.Integer(),
            nullable=False,
            server_default="1",
        ),
    )
    op.create_check_constraint(
        "ck_sewing_operations_quantity_per_item_positive",
        "sewing_operations",
        "quantity_per_item >= 1",
    )

    op.add_column(
        "assembly_operation_lines",
        sa.Column(
            "quantity_per_item",
            sa.Integer(),
            nullable=False,
            server_default="1",
        ),
    )
    op.create_check_constraint(
        "ck_assembly_operation_lines_quantity_per_item",
        "assembly_operation_lines",
        "quantity_per_item >= 1",
    )

    op.add_column(
        "sales_order_item_assembly_operation_snapshots",
        sa.Column(
            "quantity_per_item",
            sa.Integer(),
            nullable=False,
            server_default="1",
        ),
    )
    op.create_check_constraint(
        "ck_sales_order_item_assembly_op_snapshot_qty",
        "sales_order_item_assembly_operation_snapshots",
        "quantity_per_item >= 1",
    )


def downgrade() -> None:
    op.drop_constraint(
        "ck_sales_order_item_assembly_op_snapshot_qty",
        "sales_order_item_assembly_operation_snapshots",
        type_="check",
    )
    op.drop_column(
        "sales_order_item_assembly_operation_snapshots",
        "quantity_per_item",
    )

    op.drop_constraint(
        "ck_assembly_operation_lines_quantity_per_item",
        "assembly_operation_lines",
        type_="check",
    )
    op.drop_column("assembly_operation_lines", "quantity_per_item")

    op.drop_constraint(
        "ck_sewing_operations_quantity_per_item_positive",
        "sewing_operations",
        type_="check",
    )
    op.drop_column("sewing_operations", "quantity_per_item")
