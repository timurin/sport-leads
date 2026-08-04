"""add lead soft-archive flags

Revision ID: m0b1c2d3e456
Revises: l9a0b1c2d345
Create Date: 2026-08-01
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "m0b1c2d3e456"
down_revision = "l9a0b1c2d345"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "leads",
        sa.Column("is_archived", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )
    op.add_column(
        "leads",
        sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(op.f("ix_leads_is_archived"), "leads", ["is_archived"])


def downgrade() -> None:
    op.drop_index(op.f("ix_leads_is_archived"), table_name="leads")
    op.drop_column("leads", "archived_at")
    op.drop_column("leads", "is_archived")
