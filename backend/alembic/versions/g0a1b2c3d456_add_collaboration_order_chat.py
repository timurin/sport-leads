"""Add collaboration order chat tables (ADR-026 / Stage 19.1–19.2).

Revision ID: g0a1b2c3d456
Revises: f9a0b1c2d345
Create Date: 2026-08-04 13:10:00.000000

"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "g0a1b2c3d456"
down_revision: Union[str, Sequence[str], None] = "f9a0b1c2d345"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "collaboration_threads",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "sales_order_id",
            sa.Integer(),
            sa.ForeignKey("sales_orders.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.UniqueConstraint(
            "sales_order_id",
            name="uq_collaboration_threads_sales_order_id",
        ),
    )
    op.create_index(
        "ix_collaboration_threads_sales_order_id",
        "collaboration_threads",
        ["sales_order_id"],
    )

    op.create_table(
        "collaboration_messages",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "thread_id",
            sa.Integer(),
            sa.ForeignKey("collaboration_threads.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "author_platform_user_id",
            sa.Integer(),
            sa.ForeignKey("platform_users.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column(
            "technical_card_id",
            sa.Integer(),
            sa.ForeignKey("technical_cards.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index(
        "ix_collaboration_messages_thread_id",
        "collaboration_messages",
        ["thread_id"],
    )
    op.create_index(
        "ix_collaboration_messages_technical_card_id",
        "collaboration_messages",
        ["technical_card_id"],
    )
    op.create_index(
        "ix_collaboration_messages_created_at",
        "collaboration_messages",
        ["created_at"],
    )
    op.create_index(
        "ix_collaboration_messages_author_platform_user_id",
        "collaboration_messages",
        ["author_platform_user_id"],
    )

    op.create_table(
        "collaboration_mentions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "message_id",
            sa.Integer(),
            sa.ForeignKey("collaboration_messages.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "mentioned_platform_user_id",
            sa.Integer(),
            sa.ForeignKey("platform_users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("mentioned_login_snapshot", sa.String(length=64), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.UniqueConstraint(
            "message_id",
            "mentioned_platform_user_id",
            name="uq_collaboration_mentions_message_user",
        ),
    )
    op.create_index(
        "ix_collaboration_mentions_message_id",
        "collaboration_mentions",
        ["message_id"],
    )
    op.create_index(
        "ix_collaboration_mentions_mentioned_platform_user_id",
        "collaboration_mentions",
        ["mentioned_platform_user_id"],
    )

    op.create_table(
        "collaboration_microtasks",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "sales_order_id",
            sa.Integer(),
            sa.ForeignKey("sales_orders.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column(
            "status",
            sa.String(length=20),
            nullable=False,
            server_default="open",
        ),
        sa.Column(
            "assignee_platform_user_id",
            sa.Integer(),
            sa.ForeignKey("platform_users.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "created_by_platform_user_id",
            sa.Integer(),
            sa.ForeignKey("platform_users.id", ondelete="RESTRICT"),
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
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "ix_collaboration_microtasks_sales_order_id",
        "collaboration_microtasks",
        ["sales_order_id"],
    )
    op.create_index(
        "ix_collaboration_microtasks_assignee",
        "collaboration_microtasks",
        ["assignee_platform_user_id"],
    )
    op.create_index(
        "ix_collaboration_microtasks_status",
        "collaboration_microtasks",
        ["status"],
    )
    op.create_index(
        "ix_collaboration_microtasks_technical_card_id",
        "collaboration_microtasks",
        ["technical_card_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_collaboration_microtasks_technical_card_id",
        table_name="collaboration_microtasks",
    )
    op.drop_index(
        "ix_collaboration_microtasks_status",
        table_name="collaboration_microtasks",
    )
    op.drop_index(
        "ix_collaboration_microtasks_assignee",
        table_name="collaboration_microtasks",
    )
    op.drop_index(
        "ix_collaboration_microtasks_sales_order_id",
        table_name="collaboration_microtasks",
    )
    op.drop_table("collaboration_microtasks")

    op.drop_index(
        "ix_collaboration_mentions_mentioned_platform_user_id",
        table_name="collaboration_mentions",
    )
    op.drop_index(
        "ix_collaboration_mentions_message_id",
        table_name="collaboration_mentions",
    )
    op.drop_table("collaboration_mentions")

    op.drop_index(
        "ix_collaboration_messages_author_platform_user_id",
        table_name="collaboration_messages",
    )
    op.drop_index(
        "ix_collaboration_messages_created_at",
        table_name="collaboration_messages",
    )
    op.drop_index(
        "ix_collaboration_messages_technical_card_id",
        table_name="collaboration_messages",
    )
    op.drop_index(
        "ix_collaboration_messages_thread_id",
        table_name="collaboration_messages",
    )
    op.drop_table("collaboration_messages")

    op.drop_index(
        "ix_collaboration_threads_sales_order_id",
        table_name="collaboration_threads",
    )
    op.drop_table("collaboration_threads")
