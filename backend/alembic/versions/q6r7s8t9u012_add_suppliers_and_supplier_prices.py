"""Add suppliers and supplier_prices (ADR-033 / 13.1.1.2).

Revision ID: q6r7s8t9u012
Revises: p5q6r7s8t901
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "q6r7s8t9u012"
down_revision = "p5q6r7s8t901"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "suppliers",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("code", sa.String(length=50), nullable=True),
        sa.Column("inn", sa.String(length=12), nullable=True),
        sa.Column("kpp", sa.String(length=9), nullable=True),
        sa.Column("phone", sa.String(length=50), nullable=True),
        sa.Column("email", sa.String(length=255), nullable=True),
        sa.Column("legal_address", sa.String(length=500), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "is_active",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
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
        sa.UniqueConstraint("code", name="uq_suppliers_code"),
    )
    op.create_index("ix_suppliers_name", "suppliers", ["name"])
    op.create_index("ix_suppliers_code", "suppliers", ["code"])
    op.create_index("ix_suppliers_inn", "suppliers", ["inn"])
    op.create_index("ix_suppliers_is_active", "suppliers", ["is_active"])

    op.create_table(
        "supplier_prices",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("supplier_id", sa.Integer(), nullable=False),
        sa.Column("nomenclature_id", sa.Integer(), nullable=False),
        sa.Column("unit_price", sa.Numeric(precision=14, scale=2), nullable=False),
        sa.Column(
            "currency",
            sa.String(length=3),
            nullable=False,
            server_default="RUB",
        ),
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
            ["supplier_id"],
            ["suppliers.id"],
            name="fk_supplier_prices_supplier_id",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["nomenclature_id"],
            ["nomenclatures.id"],
            name="fk_supplier_prices_nomenclature_id",
            ondelete="RESTRICT",
        ),
        sa.UniqueConstraint(
            "supplier_id",
            "nomenclature_id",
            name="uq_supplier_prices_supplier_nomenclature",
        ),
        sa.CheckConstraint(
            "unit_price > 0",
            name="ck_supplier_prices_unit_price_positive",
        ),
        sa.CheckConstraint(
            "currency = 'RUB'",
            name="ck_supplier_prices_currency_rub",
        ),
    )
    op.create_index(
        "ix_supplier_prices_supplier_id", "supplier_prices", ["supplier_id"]
    )
    op.create_index(
        "ix_supplier_prices_nomenclature_id",
        "supplier_prices",
        ["nomenclature_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_supplier_prices_nomenclature_id", table_name="supplier_prices")
    op.drop_index("ix_supplier_prices_supplier_id", table_name="supplier_prices")
    op.drop_table("supplier_prices")
    op.drop_index("ix_suppliers_is_active", table_name="suppliers")
    op.drop_index("ix_suppliers_inn", table_name="suppliers")
    op.drop_index("ix_suppliers_code", table_name="suppliers")
    op.drop_index("ix_suppliers_name", table_name="suppliers")
    op.drop_table("suppliers")
