"""Persist the existing platform debug-mode setting, default off.

Revision ID: e1f2a3b4c567
Revises: d0e1f2a3b456
"""
from alembic import op
import sqlalchemy as sa

revision = "e1f2a3b4c567"
down_revision = "d0e1f2a3b456"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("platform_system_settings", sa.Column("debug_mode", sa.Boolean(), nullable=False, server_default=sa.false()))


def downgrade() -> None:
    op.drop_column("platform_system_settings", "debug_mode")
