"""Add purchase_orders and purchase_order_lines (ADR-034 / 13.1.2.2).

Revision ID: r7s8t9u0v123
Revises: q6r7s8t9u012
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "r7s8t9u0v123"
down_revision = "q6r7s8t9u012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "purchase_orders",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("number", sa.String(length=80), nullable=False),
        sa.Column("supplier_id", sa.Integer(), nullable=False),
        sa.Column(
            "status",
            sa.String(length=20),
            nullable=False,
            server_default="draft",
        ),
        sa.Column("expected_date", sa.Date(), nullable=True),
        sa.Column("warehouse_id", sa.Integer(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "currency",
            sa.String(length=3),
            nullable=False,
            server_default="RUB",
        ),
        sa.Column("ordered_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cancelled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.ForeignKeyConstraint(
            ["supplier_id"],
            ["suppliers.id"],
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["warehouse_id"],
            ["warehouses.id"],
            ondelete="RESTRICT",
        ),
        sa.UniqueConstraint("number", name="uq_purchase_orders_number"),
        sa.CheckConstraint(
            "status IN ('draft', 'ordered', 'cancelled')",
            name="ck_purchase_orders_status",
        ),
        sa.CheckConstraint(
            "currency = 'RUB'",
            name="ck_purchase_orders_currency_rub",
        ),
    )
    op.create_index("ix_purchase_orders_number", "purchase_orders", ["number"])
    op.create_index(
        "ix_purchase_orders_supplier_id", "purchase_orders", ["supplier_id"]
    )
    op.create_index("ix_purchase_orders_status", "purchase_orders", ["status"])
    op.create_index(
        "ix_purchase_orders_warehouse_id", "purchase_orders", ["warehouse_id"]
    )

    op.create_table(
        "purchase_order_lines",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("purchase_order_id", sa.Integer(), nullable=False),
        sa.Column("nomenclature_id", sa.Integer(), nullable=False),
        sa.Column("quantity", sa.Numeric(14, 3), nullable=False),
        sa.Column("unit_price", sa.Numeric(14, 2), nullable=False),
        sa.Column("comment", sa.String(length=255), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.ForeignKeyConstraint(
            ["purchase_order_id"],
            ["purchase_orders.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["nomenclature_id"],
            ["nomenclatures.id"],
            ondelete="RESTRICT",
        ),
        sa.UniqueConstraint(
            "purchase_order_id",
            "nomenclature_id",
            name="uq_purchase_order_lines_po_nomenclature",
        ),
        sa.CheckConstraint(
            "quantity > 0",
            name="ck_purchase_order_lines_quantity_positive",
        ),
        sa.CheckConstraint(
            "unit_price > 0",
            name="ck_purchase_order_lines_unit_price_positive",
        ),
    )
    op.create_index(
        "ix_purchase_order_lines_purchase_order_id",
        "purchase_order_lines",
        ["purchase_order_id"],
    )
    op.create_index(
        "ix_purchase_order_lines_nomenclature_id",
        "purchase_order_lines",
        ["nomenclature_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_purchase_order_lines_nomenclature_id",
        table_name="purchase_order_lines",
    )
    op.drop_index(
        "ix_purchase_order_lines_purchase_order_id",
        table_name="purchase_order_lines",
    )
    op.drop_table("purchase_order_lines")
    op.drop_index("ix_purchase_orders_warehouse_id", table_name="purchase_orders")
    op.drop_index("ix_purchase_orders_status", table_name="purchase_orders")
    op.drop_index("ix_purchase_orders_supplier_id", table_name="purchase_orders")
    op.drop_index("ix_purchase_orders_number", table_name="purchase_orders")
    op.drop_table("purchase_orders")
