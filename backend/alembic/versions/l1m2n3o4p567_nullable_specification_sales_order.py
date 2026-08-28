"""Nullable Specification.sales_order_id for standalone PO (28.5.3).

Revision ID: l1m2n3o4p567
Revises: k0l1m2n3o456
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "l1m2n3o4p567"
down_revision = "k0l1m2n3o456"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column(
        "specifications",
        "sales_order_id",
        existing_type=sa.Integer(),
        nullable=True,
    )


def downgrade() -> None:
    op.alter_column(
        "specifications",
        "sales_order_id",
        existing_type=sa.Integer(),
        nullable=False,
    )
