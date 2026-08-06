"""nullable lead_events.lead_id for order-without-lead history

Revision ID: n7o8p9q0r123
Revises: m6n7o8p9q012
Create Date: 2026-08-06
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "n7o8p9q0r123"
down_revision = "m6n7o8p9q012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column(
        "lead_events",
        "lead_id",
        existing_type=sa.Integer(),
        nullable=True,
    )
    op.create_check_constraint(
        "ck_lead_events_lead_or_order",
        "lead_events",
        "lead_id IS NOT NULL OR order_id IS NOT NULL",
    )


def downgrade() -> None:
    op.drop_constraint("ck_lead_events_lead_or_order", "lead_events", type_="check")
    op.execute(
        "UPDATE lead_events SET lead_id = ("
        "SELECT so.lead_id FROM sales_orders so WHERE so.id = lead_events.order_id"
        ") WHERE lead_id IS NULL AND order_id IS NOT NULL"
    )
    op.execute("DELETE FROM lead_events WHERE lead_id IS NULL")
    op.alter_column(
        "lead_events",
        "lead_id",
        existing_type=sa.Integer(),
        nullable=False,
    )
