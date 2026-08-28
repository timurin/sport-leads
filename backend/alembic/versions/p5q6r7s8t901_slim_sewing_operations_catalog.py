"""Slim sewing-operation catalog leaf (26.10.2).

Revision ID: p5q6r7s8t901
Revises: o4p5q6r7s890

Add description (≤256). Drop catalog economics: cost, quantity_per_item,
duration_seconds + CHECK constraints. SoT for those fields is
AssemblyOperationLine (26.10).
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "p5q6r7s8t901"
down_revision = "o4p5q6r7s890"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "sewing_operations",
        sa.Column("description", sa.String(length=256), nullable=True),
    )
    op.drop_constraint(
        "ck_sewing_operations_cost_non_negative",
        "sewing_operations",
        type_="check",
    )
    op.drop_constraint(
        "ck_sewing_operations_quantity_per_item_positive",
        "sewing_operations",
        type_="check",
    )
    op.drop_constraint(
        "ck_sewing_operations_duration_seconds_non_negative",
        "sewing_operations",
        type_="check",
    )
    op.drop_column("sewing_operations", "cost")
    op.drop_column("sewing_operations", "quantity_per_item")
    op.drop_column("sewing_operations", "duration_seconds")


def downgrade() -> None:
    op.add_column(
        "sewing_operations",
        sa.Column(
            "cost",
            sa.Numeric(precision=14, scale=2),
            nullable=False,
            server_default="0",
        ),
    )
    op.add_column(
        "sewing_operations",
        sa.Column(
            "quantity_per_item",
            sa.Integer(),
            nullable=False,
            server_default="1",
        ),
    )
    op.add_column(
        "sewing_operations",
        sa.Column(
            "duration_seconds",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
    )
    op.create_check_constraint(
        "ck_sewing_operations_cost_non_negative",
        "sewing_operations",
        "cost >= 0",
    )
    op.create_check_constraint(
        "ck_sewing_operations_quantity_per_item_positive",
        "sewing_operations",
        "quantity_per_item >= 1",
    )
    op.create_check_constraint(
        "ck_sewing_operations_duration_seconds_non_negative",
        "sewing_operations",
        "duration_seconds >= 0",
    )
    op.alter_column("sewing_operations", "cost", server_default=None)
    op.alter_column("sewing_operations", "quantity_per_item", server_default=None)
    op.alter_column("sewing_operations", "duration_seconds", server_default=None)
    op.drop_column("sewing_operations", "description")
