"""Add collaboration notification inbox (Stage 19.4 / ADR-026).

Revision ID: h1b2c3d4e567
Revises: g0a1b2c3d456
Create Date: 2026-08-04 13:45:00.000000

"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "h1b2c3d4e567"
down_revision: Union[str, Sequence[str], None] = "g0a1b2c3d456"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "collaboration_notifications",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "recipient_platform_user_id",
            sa.Integer(),
            sa.ForeignKey("platform_users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("kind", sa.String(length=40), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column(
            "sales_order_id",
            sa.Integer(),
            sa.ForeignKey("sales_orders.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "technical_card_id",
            sa.Integer(),
            sa.ForeignKey("technical_cards.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "source_message_id",
            sa.Integer(),
            sa.ForeignKey("collaboration_messages.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "microtask_id",
            sa.Integer(),
            sa.ForeignKey("collaboration_microtasks.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "actor_platform_user_id",
            sa.Integer(),
            sa.ForeignKey("platform_users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "ix_collaboration_notifications_recipient",
        "collaboration_notifications",
        ["recipient_platform_user_id"],
    )
    op.create_index(
        "ix_collaboration_notifications_created_at",
        "collaboration_notifications",
        ["created_at"],
    )
    op.create_index(
        "ix_collaboration_notifications_read_at",
        "collaboration_notifications",
        ["read_at"],
    )
    op.create_index(
        "ix_collaboration_notifications_kind",
        "collaboration_notifications",
        ["kind"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_collaboration_notifications_kind",
        table_name="collaboration_notifications",
    )
    op.drop_index(
        "ix_collaboration_notifications_read_at",
        table_name="collaboration_notifications",
    )
    op.drop_index(
        "ix_collaboration_notifications_created_at",
        table_name="collaboration_notifications",
    )
    op.drop_index(
        "ix_collaboration_notifications_recipient",
        table_name="collaboration_notifications",
    )
    op.drop_table("collaboration_notifications")
