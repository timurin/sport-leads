"""Alembic: platform system settings logo fields (18.1.2).

Revision ID: x1y2z3a4b567
Revises: w0x1y2z3a456
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "x1y2z3a4b567"
down_revision = "w0x1y2z3a456"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "platform_system_settings",
        sa.Column("logo_storage_key", sa.String(length=512), nullable=True),
    )
    op.add_column(
        "platform_system_settings",
        sa.Column("logo_mime_type", sa.String(length=128), nullable=True),
    )
    op.add_column(
        "platform_system_settings",
        sa.Column("logo_original_filename", sa.String(length=255), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("platform_system_settings", "logo_original_filename")
    op.drop_column("platform_system_settings", "logo_mime_type")
    op.drop_column("platform_system_settings", "logo_storage_key")
