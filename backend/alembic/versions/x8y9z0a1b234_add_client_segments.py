"""Add client_segments tags (2.3.2).

Revision ID: x8y9z0a1b234
Revises: w7x8y9z0a123
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "x8y9z0a1b234"
down_revision = "w7x8y9z0a123"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "client_segments",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "client_id",
            sa.Integer(),
            sa.ForeignKey("clients.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(length=64), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index("ix_client_segments_client_id", "client_segments", ["client_id"])


def downgrade() -> None:
    op.drop_index("ix_client_segments_client_id", table_name="client_segments")
    op.drop_table("client_segments")
