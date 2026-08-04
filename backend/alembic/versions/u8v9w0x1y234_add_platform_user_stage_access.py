"""Alembic: platform_user ↔ production_stage executors (17.1.2.8).

Revision ID: u8v9w0x1y234
Revises: t7u8v9w0x123
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "u8v9w0x1y234"
down_revision = "t7u8v9w0x123"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "platform_user_stage_access",
        sa.Column(
            "platform_user_id",
            sa.Integer(),
            sa.ForeignKey("platform_users.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "production_stage_id",
            sa.Integer(),
            sa.ForeignKey("production_stages.id", ondelete="CASCADE"),
            primary_key=True,
        ),
    )
    op.create_index(
        "ix_platform_user_stage_access_stage",
        "platform_user_stage_access",
        ["production_stage_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_platform_user_stage_access_stage",
        table_name="platform_user_stage_access",
    )
    op.drop_table("platform_user_stage_access")
