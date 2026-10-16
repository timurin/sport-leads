"""Separate workshop queue order from calendar board position.

Revision ID: f2a3b4c5d678
Revises: e1f2a3b4c567
"""
from alembic import op
import sqlalchemy as sa

revision = "f2a3b4c5d678"
down_revision = "e1f2a3b4c567"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("calendar_assignments", sa.Column("queue_position", sa.Integer(), nullable=True))
    op.create_check_constraint("ck_calendar_assignment_queue_position", "calendar_assignments", "queue_position IS NULL OR queue_position >= 1")


def downgrade() -> None:
    op.drop_constraint("ck_calendar_assignment_queue_position", "calendar_assignments", type_="check")
    op.drop_column("calendar_assignments", "queue_position")
