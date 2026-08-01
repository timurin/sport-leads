"""add sales quotations and invoices

Revision ID: g4b5c6d7e890
Revises: f3a4b5c6d789
Create Date: 2026-07-31
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "g4b5c6d7e890"
down_revision = "f3a4b5c6d789"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "sales_quotations",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("number", sa.String(length=50), nullable=False),
        sa.Column("sales_order_id", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="draft"),
        sa.Column("currency_code", sa.String(length=3), nullable=False, server_default="RUB"),
        sa.Column("discount_percent", sa.Numeric(5, 2), nullable=True),
        sa.Column(
            "discount_amount",
            sa.Numeric(14, 2),
            nullable=False,
            server_default="0.00",
        ),
        sa.Column(
            "vat_amount",
            sa.Numeric(14, 2),
            nullable=False,
            server_default="0.00",
        ),
        sa.Column(
            "amount",
            sa.Numeric(14, 2),
            nullable=False,
            server_default="0.00",
        ),
        sa.Column(
            "amount_net",
            sa.Numeric(14, 2),
            nullable=False,
            server_default="0.00",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(
            ["sales_order_id"],
            ["sales_orders.id"],
            ondelete="CASCADE",
        ),
        sa.UniqueConstraint("number", name="uq_sales_quotations_number"),
        sa.CheckConstraint(
            "discount_percent IS NULL OR (discount_percent >= 0 AND discount_percent <= 100)",
            name="ck_sales_quotations_discount_percent_range",
        ),
        sa.CheckConstraint(
            "discount_amount >= 0",
            name="ck_sales_quotations_discount_amount_nonnegative",
        ),
        sa.CheckConstraint(
            "vat_amount >= 0",
            name="ck_sales_quotations_vat_amount_nonnegative",
        ),
        sa.CheckConstraint("amount >= 0", name="ck_sales_quotations_amount_nonnegative"),
        sa.CheckConstraint(
            "length(currency_code) = 3",
            name="ck_sales_quotations_currency_code_length",
        ),
    )
    op.create_index("ix_sales_quotations_number", "sales_quotations", ["number"])
    op.create_index("ix_sales_quotations_sales_order_id", "sales_quotations", ["sales_order_id"])
    op.create_index("ix_sales_quotations_status", "sales_quotations", ["status"])

    op.create_table(
        "sales_quotation_items",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("quotation_id", sa.Integer(), nullable=False),
        sa.Column("source_order_item_id", sa.Integer(), nullable=True),
        sa.Column("position", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("snapshot_name", sa.String(length=255), nullable=False),
        sa.Column("unit", sa.String(length=30), nullable=False, server_default="шт"),
        sa.Column("quantity", sa.Numeric(14, 3), nullable=False),
        sa.Column("unit_price", sa.Numeric(14, 2), nullable=False),
        sa.Column("discount_percent", sa.Numeric(5, 2), nullable=True),
        sa.Column(
            "discount_amount",
            sa.Numeric(14, 2),
            nullable=False,
            server_default="0.00",
        ),
        sa.Column("line_amount", sa.Numeric(14, 2), nullable=False),
        sa.Column("vat_rate_id", sa.Integer(), nullable=True),
        sa.Column("vat_rate_percent", sa.Numeric(5, 2), nullable=True),
        sa.Column(
            "price_includes_vat",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
        sa.Column(
            "vat_amount",
            sa.Numeric(14, 2),
            nullable=False,
            server_default="0.00",
        ),
        sa.Column("line_total", sa.Numeric(14, 2), nullable=False),
        sa.ForeignKeyConstraint(
            ["quotation_id"],
            ["sales_quotations.id"],
            ondelete="CASCADE",
        ),
        sa.CheckConstraint("quantity > 0", name="ck_sales_quotation_items_quantity_positive"),
        sa.CheckConstraint(
            "unit_price >= 0",
            name="ck_sales_quotation_items_unit_price_nonnegative",
        ),
        sa.CheckConstraint(
            "discount_percent IS NULL OR (discount_percent >= 0 AND discount_percent <= 100)",
            name="ck_sales_quotation_items_discount_percent_range",
        ),
        sa.CheckConstraint(
            "discount_amount >= 0",
            name="ck_sales_quotation_items_discount_amount_nonnegative",
        ),
        sa.CheckConstraint(
            "line_amount >= 0",
            name="ck_sales_quotation_items_line_amount_nonnegative",
        ),
        sa.CheckConstraint(
            "vat_amount >= 0",
            name="ck_sales_quotation_items_vat_amount_nonnegative",
        ),
        sa.CheckConstraint(
            "line_total >= 0",
            name="ck_sales_quotation_items_line_total_nonnegative",
        ),
    )
    op.create_index(
        "ix_sales_quotation_items_quotation_id",
        "sales_quotation_items",
        ["quotation_id"],
    )

    op.create_table(
        "sales_invoices",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("number", sa.String(length=50), nullable=False),
        sa.Column("sales_order_id", sa.Integer(), nullable=False),
        sa.Column("quotation_id", sa.Integer(), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="draft"),
        sa.Column("currency_code", sa.String(length=3), nullable=False, server_default="RUB"),
        sa.Column("discount_percent", sa.Numeric(5, 2), nullable=True),
        sa.Column(
            "discount_amount",
            sa.Numeric(14, 2),
            nullable=False,
            server_default="0.00",
        ),
        sa.Column(
            "vat_amount",
            sa.Numeric(14, 2),
            nullable=False,
            server_default="0.00",
        ),
        sa.Column(
            "amount",
            sa.Numeric(14, 2),
            nullable=False,
            server_default="0.00",
        ),
        sa.Column(
            "amount_net",
            sa.Numeric(14, 2),
            nullable=False,
            server_default="0.00",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(
            ["sales_order_id"],
            ["sales_orders.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["quotation_id"],
            ["sales_quotations.id"],
            ondelete="SET NULL",
        ),
        sa.UniqueConstraint("number", name="uq_sales_invoices_number"),
        sa.CheckConstraint(
            "discount_percent IS NULL OR (discount_percent >= 0 AND discount_percent <= 100)",
            name="ck_sales_invoices_discount_percent_range",
        ),
        sa.CheckConstraint(
            "discount_amount >= 0",
            name="ck_sales_invoices_discount_amount_nonnegative",
        ),
        sa.CheckConstraint(
            "vat_amount >= 0",
            name="ck_sales_invoices_vat_amount_nonnegative",
        ),
        sa.CheckConstraint("amount >= 0", name="ck_sales_invoices_amount_nonnegative"),
        sa.CheckConstraint(
            "length(currency_code) = 3",
            name="ck_sales_invoices_currency_code_length",
        ),
    )
    op.create_index("ix_sales_invoices_number", "sales_invoices", ["number"])
    op.create_index("ix_sales_invoices_sales_order_id", "sales_invoices", ["sales_order_id"])
    op.create_index("ix_sales_invoices_quotation_id", "sales_invoices", ["quotation_id"])
    op.create_index("ix_sales_invoices_status", "sales_invoices", ["status"])

    op.create_table(
        "sales_invoice_items",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("invoice_id", sa.Integer(), nullable=False),
        sa.Column("source_order_item_id", sa.Integer(), nullable=True),
        sa.Column("position", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("snapshot_name", sa.String(length=255), nullable=False),
        sa.Column("unit", sa.String(length=30), nullable=False, server_default="шт"),
        sa.Column("quantity", sa.Numeric(14, 3), nullable=False),
        sa.Column("unit_price", sa.Numeric(14, 2), nullable=False),
        sa.Column("discount_percent", sa.Numeric(5, 2), nullable=True),
        sa.Column(
            "discount_amount",
            sa.Numeric(14, 2),
            nullable=False,
            server_default="0.00",
        ),
        sa.Column("line_amount", sa.Numeric(14, 2), nullable=False),
        sa.Column("vat_rate_id", sa.Integer(), nullable=True),
        sa.Column("vat_rate_percent", sa.Numeric(5, 2), nullable=True),
        sa.Column(
            "price_includes_vat",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
        sa.Column(
            "vat_amount",
            sa.Numeric(14, 2),
            nullable=False,
            server_default="0.00",
        ),
        sa.Column("line_total", sa.Numeric(14, 2), nullable=False),
        sa.ForeignKeyConstraint(
            ["invoice_id"],
            ["sales_invoices.id"],
            ondelete="CASCADE",
        ),
        sa.CheckConstraint("quantity > 0", name="ck_sales_invoice_items_quantity_positive"),
        sa.CheckConstraint(
            "unit_price >= 0",
            name="ck_sales_invoice_items_unit_price_nonnegative",
        ),
        sa.CheckConstraint(
            "discount_percent IS NULL OR (discount_percent >= 0 AND discount_percent <= 100)",
            name="ck_sales_invoice_items_discount_percent_range",
        ),
        sa.CheckConstraint(
            "discount_amount >= 0",
            name="ck_sales_invoice_items_discount_amount_nonnegative",
        ),
        sa.CheckConstraint(
            "line_amount >= 0",
            name="ck_sales_invoice_items_line_amount_nonnegative",
        ),
        sa.CheckConstraint(
            "vat_amount >= 0",
            name="ck_sales_invoice_items_vat_amount_nonnegative",
        ),
        sa.CheckConstraint(
            "line_total >= 0",
            name="ck_sales_invoice_items_line_total_nonnegative",
        ),
    )
    op.create_index(
        "ix_sales_invoice_items_invoice_id",
        "sales_invoice_items",
        ["invoice_id"],
    )


def downgrade() -> None:
    op.drop_table("sales_invoice_items")
    op.drop_table("sales_invoices")
    op.drop_table("sales_quotation_items")
    op.drop_table("sales_quotations")
