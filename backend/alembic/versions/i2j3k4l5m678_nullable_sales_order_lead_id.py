"""Nullable SalesOrder.lead_id for create-without-lead (v1.00 / 0.4.2).

Revision ID: i2j3k4l5m678
Revises: h1b2c3d4e567
Create Date: 2026-08-05 17:20:00.000000

"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "i2j3k4l5m678"
down_revision: Union[str, Sequence[str], None] = "h1b2c3d4e567"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        "sales_orders",
        "lead_id",
        existing_type=sa.Integer(),
        nullable=True,
    )


def downgrade() -> None:
    # Fail loudly if nulls exist — operator must backfill or delete before downgrade.
    op.alter_column(
        "sales_orders",
        "lead_id",
        existing_type=sa.Integer(),
        nullable=False,
    )
