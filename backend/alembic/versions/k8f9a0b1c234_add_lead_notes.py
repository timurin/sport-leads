"""add lead_notes for CRM note persistence

Revision ID: k8f9a0b1c234
Revises: j7e8f9a0b123
Create Date: 2026-08-01
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "k8f9a0b1c234"
down_revision = "j7e8f9a0b123"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "lead_notes",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("lead_id", sa.Integer(), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("author_id", sa.Integer(), nullable=True),
        sa.Column("is_pinned", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("mentioned_user_ids", sa.JSON(), nullable=False, server_default=sa.text("'[]'")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["author_id"], ["sales_users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["lead_id"], ["leads.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_lead_notes_lead_id"), "lead_notes", ["lead_id"])
    op.create_index(op.f("ix_lead_notes_author_id"), "lead_notes", ["author_id"])
    op.create_index(op.f("ix_lead_notes_created_at"), "lead_notes", ["created_at"])


def downgrade() -> None:
    op.drop_index(op.f("ix_lead_notes_created_at"), table_name="lead_notes")
    op.drop_index(op.f("ix_lead_notes_author_id"), table_name="lead_notes")
    op.drop_index(op.f("ix_lead_notes_lead_id"), table_name="lead_notes")
    op.drop_table("lead_notes")
