"""add organizations and sales order organization link

Revision ID: b7c8d9e0f123
Revises: a91d6e3f4b20
Create Date: 2026-07-18 23:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = "b7c8d9e0f123"
down_revision: str | None = "a91d6e3f4b20"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "organizations",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("legal_form", sa.String(length=50), nullable=True),
        sa.Column("tax_id", sa.String(length=12), nullable=True),
        sa.Column("kpp", sa.String(length=9), nullable=True),
        sa.Column("tax_system", sa.String(length=100), nullable=True),
        sa.Column("director", sa.String(length=255), nullable=True),
        sa.Column("legal_address", sa.String(length=500), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_organizations_name", "organizations", ["name"])
    op.create_index("ix_organizations_tax_id", "organizations", ["tax_id"], unique=True)
    op.create_index("ix_organizations_is_active", "organizations", ["is_active"])
    op.add_column("sales_orders", sa.Column("organization_id", sa.Integer(), nullable=True))
    op.create_index("ix_sales_orders_organization_id", "sales_orders", ["organization_id"])
    op.create_foreign_key(
        "fk_sales_orders_organization_id_organizations",
        "sales_orders",
        "organizations",
        ["organization_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_sales_orders_organization_id_organizations",
        "sales_orders",
        type_="foreignkey",
    )
    op.drop_index("ix_sales_orders_organization_id", table_name="sales_orders")
    op.drop_column("sales_orders", "organization_id")
    op.drop_index("ix_organizations_is_active", table_name="organizations")
    op.drop_index("ix_organizations_tax_id", table_name="organizations")
    op.drop_index("ix_organizations_name", table_name="organizations")
    op.drop_table("organizations")
