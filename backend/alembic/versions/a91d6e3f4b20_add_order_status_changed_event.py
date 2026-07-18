"""add order status changed event type

Revision ID: a91d6e3f4b20
Revises: e4b8a2c91d7f
Create Date: 2026-07-18 22:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = "a91d6e3f4b20"
down_revision: str | None = "f2a7c4d8e901"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.alter_column(
        "lead_events",
        "event_type",
        existing_type=sa.String(length=19),
        type_=sa.String(length=20),
        existing_nullable=False,
    )


def downgrade() -> None:
    op.execute(
        "UPDATE lead_events SET event_type = 'order_created' "
        "WHERE event_type = 'order_status_changed'"
    )
    op.alter_column(
        "lead_events",
        "event_type",
        existing_type=sa.String(length=20),
        type_=sa.String(length=19),
        existing_nullable=False,
    )
