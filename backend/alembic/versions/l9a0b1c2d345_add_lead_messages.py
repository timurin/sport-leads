"""add lead_messages for CRM communications persistence

Revision ID: l9a0b1c2d345
Revises: k8f9a0b1c234
Create Date: 2026-08-01
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "l9a0b1c2d345"
down_revision = "k8f9a0b1c234"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "lead_messages",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("lead_id", sa.Integer(), nullable=False),
        sa.Column("channel", sa.String(length=30), nullable=False),
        sa.Column("direction", sa.String(length=20), nullable=False, server_default="outgoing"),
        sa.Column("text", sa.Text(), nullable=False, server_default=""),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="sent"),
        sa.Column("author_id", sa.Integer(), nullable=True),
        sa.Column("sender_name", sa.String(length=255), nullable=True),
        sa.Column("recipient_name", sa.String(length=255), nullable=True),
        sa.Column("external_id", sa.String(length=255), nullable=True),
        sa.Column("attachments", sa.JSON(), nullable=False, server_default=sa.text("'[]'")),
        sa.Column("is_mock", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("sent_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["author_id"], ["sales_users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["lead_id"], ["leads.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_lead_messages_lead_id"), "lead_messages", ["lead_id"])
    op.create_index(op.f("ix_lead_messages_channel"), "lead_messages", ["channel"])
    op.create_index(op.f("ix_lead_messages_author_id"), "lead_messages", ["author_id"])
    op.create_index(op.f("ix_lead_messages_sent_at"), "lead_messages", ["sent_at"])


def downgrade() -> None:
    op.drop_index(op.f("ix_lead_messages_sent_at"), table_name="lead_messages")
    op.drop_index(op.f("ix_lead_messages_author_id"), table_name="lead_messages")
    op.drop_index(op.f("ix_lead_messages_channel"), table_name="lead_messages")
    op.drop_index(op.f("ix_lead_messages_lead_id"), table_name="lead_messages")
    op.drop_table("lead_messages")
