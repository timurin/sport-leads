"""add lead customer profile

Revision ID: c12f0f2d0f4b
Revises: b6c4e2f91a07
Create Date: 2026-07-17 18:15:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = "c12f0f2d0f4b"
down_revision: str | None = "b6c4e2f91a07"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "leads",
        sa.Column(
            "customer_type",
            sa.Enum(
                "person",
                "sole_proprietor",
                "company",
                name="lead_customer_type",
                native_enum=False,
            ),
            nullable=True,
        ),
    )
    op.add_column("leads", sa.Column("tax_id", sa.String(length=12), nullable=True))
    op.add_column("leads", sa.Column("website", sa.String(length=255), nullable=True))
    op.add_column("leads", sa.Column("region", sa.String(length=150), nullable=True))
    op.add_column("leads", sa.Column("address", sa.String(length=500), nullable=True))
    op.add_column("leads", sa.Column("customer_comment", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("leads", "customer_comment")
    op.drop_column("leads", "address")
    op.drop_column("leads", "region")
    op.drop_column("leads", "website")
    op.drop_column("leads", "tax_id")
    op.drop_column("leads", "customer_type")
