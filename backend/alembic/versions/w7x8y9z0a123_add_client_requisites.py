"""Add client legal requisites and bank accounts (2.3.1).

Revision ID: w7x8y9z0a123
Revises: v6w7x8y9z012
Roadmap: 2.3.1
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "w7x8y9z0a123"
down_revision = "v6w7x8y9z012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("clients", sa.Column("inn", sa.String(length=12), nullable=True))
    op.add_column("clients", sa.Column("kpp", sa.String(length=9), nullable=True))
    op.add_column("clients", sa.Column("ogrn", sa.String(length=15), nullable=True))
    op.add_column("clients", sa.Column("legal_address", sa.String(length=500), nullable=True))
    op.add_column("clients", sa.Column("actual_address", sa.String(length=500), nullable=True))
    op.create_index("ix_clients_inn", "clients", ["inn"])

    op.create_table(
        "client_bank_accounts",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "client_id",
            sa.Integer(),
            sa.ForeignKey("clients.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("bank_name", sa.String(length=255), nullable=False),
        sa.Column("bik", sa.String(length=9), nullable=False),
        sa.Column("account_number", sa.String(length=20), nullable=False),
        sa.Column("corr_account", sa.String(length=20), nullable=True),
        sa.Column("is_primary", sa.Boolean(), nullable=False, server_default=sa.false()),
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
        sa.CheckConstraint(
            "sort_order >= 0",
            name="ck_client_bank_accounts_sort_order_nonnegative",
        ),
    )
    op.create_index("ix_client_bank_accounts_client_id", "client_bank_accounts", ["client_id"])


def downgrade() -> None:
    op.drop_index("ix_client_bank_accounts_client_id", table_name="client_bank_accounts")
    op.drop_table("client_bank_accounts")
    op.drop_index("ix_clients_inn", table_name="clients")
    op.drop_column("clients", "actual_address")
    op.drop_column("clients", "legal_address")
    op.drop_column("clients", "ogrn")
    op.drop_column("clients", "kpp")
    op.drop_column("clients", "inn")
