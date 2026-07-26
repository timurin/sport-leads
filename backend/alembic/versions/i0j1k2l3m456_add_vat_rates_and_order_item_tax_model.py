"""add vat_rates directory and order-item VAT/model snapshots

Revision ID: i0j1k2l3m456
Revises: h9i0j1k2l345
"""

from decimal import Decimal

import sqlalchemy as sa
from alembic import op


revision = "i0j1k2l3m456"
down_revision = "h9i0j1k2l345"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "vat_rates",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(length=50), nullable=False),
        sa.Column("rate_percent", sa.Numeric(5, 2), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
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
        sa.UniqueConstraint("rate_percent", name="uq_vat_rates_rate_percent"),
        sa.UniqueConstraint("name", name="uq_vat_rates_name"),
        sa.CheckConstraint(
            "rate_percent >= 0 AND rate_percent <= 100",
            name="ck_vat_rates_rate_percent_range",
        ),
    )
    op.create_index("ix_vat_rates_is_active", "vat_rates", ["is_active"])

    vat_rates = sa.table(
        "vat_rates",
        sa.column("name", sa.String),
        sa.column("rate_percent", sa.Numeric),
        sa.column("is_active", sa.Boolean),
        sa.column("sort_order", sa.Integer),
    )
    op.bulk_insert(
        vat_rates,
        [
            {"name": "0%", "rate_percent": Decimal("0.00"), "is_active": True, "sort_order": 10},
            {"name": "5%", "rate_percent": Decimal("5.00"), "is_active": True, "sort_order": 20},
            {"name": "22%", "rate_percent": Decimal("22.00"), "is_active": True, "sort_order": 30},
        ],
    )

    op.add_column("sales_order_items", sa.Column("vat_rate_id", sa.Integer(), nullable=True))
    op.add_column(
        "sales_order_items",
        sa.Column("vat_rate_percent", sa.Numeric(5, 2), nullable=True),
    )
    op.add_column(
        "sales_order_items",
        sa.Column("product_model_id", sa.Integer(), nullable=True),
    )
    op.add_column(
        "sales_order_items",
        sa.Column("product_model_article", sa.String(length=100), nullable=True),
    )
    op.add_column(
        "sales_order_items",
        sa.Column("product_model_name", sa.String(length=255), nullable=True),
    )
    op.create_index("ix_sales_order_items_vat_rate_id", "sales_order_items", ["vat_rate_id"])
    op.create_index(
        "ix_sales_order_items_product_model_id",
        "sales_order_items",
        ["product_model_id"],
    )
    op.create_foreign_key(
        "fk_sales_order_items_vat_rate_id",
        "sales_order_items",
        "vat_rates",
        ["vat_rate_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        "fk_sales_order_items_product_model_id",
        "sales_order_items",
        "product_models",
        ["product_model_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_sales_order_items_product_model_id", "sales_order_items", type_="foreignkey")
    op.drop_constraint("fk_sales_order_items_vat_rate_id", "sales_order_items", type_="foreignkey")
    op.drop_index("ix_sales_order_items_product_model_id", table_name="sales_order_items")
    op.drop_index("ix_sales_order_items_vat_rate_id", table_name="sales_order_items")
    op.drop_column("sales_order_items", "product_model_name")
    op.drop_column("sales_order_items", "product_model_article")
    op.drop_column("sales_order_items", "product_model_id")
    op.drop_column("sales_order_items", "vat_rate_percent")
    op.drop_column("sales_order_items", "vat_rate_id")
    op.drop_index("ix_vat_rates_is_active", table_name="vat_rates")
    op.drop_table("vat_rates")
