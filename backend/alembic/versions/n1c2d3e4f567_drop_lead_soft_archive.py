"""drop lead soft-archive flags (redundant with converted/rejected)

Revision ID: n1c2d3e4f567
Revises: m0b1c2d3e456
Create Date: 2026-08-01
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "n1c2d3e4f567"
down_revision = "m0b1c2d3e456"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_index(op.f("ix_leads_is_archived"), table_name="leads")
    op.drop_column("leads", "archived_at")
    op.drop_column("leads", "is_archived")


def downgrade() -> None:
    op.add_column(
        "leads",
        sa.Column("is_archived", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )
    op.add_column(
        "leads",
        sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(op.f("ix_leads_is_archived"), "leads", ["is_archived"])
