"""extend lead_tasks for CRM task persistence

Revision ID: j7e8f9a0b123
Revises: i6d7e8f9a012
Create Date: 2026-08-01
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "j7e8f9a0b123"
down_revision = "i6d7e8f9a012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "lead_tasks",
        sa.Column("task_type", sa.String(length=50), nullable=False, server_default="other"),
    )
    op.add_column(
        "lead_tasks",
        sa.Column("priority", sa.String(length=20), nullable=False, server_default="medium"),
    )
    op.add_column("lead_tasks", sa.Column("description", sa.Text(), nullable=True))
    op.add_column("lead_tasks", sa.Column("result", sa.Text(), nullable=True))
    op.add_column(
        "lead_tasks",
        sa.Column("due_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "lead_tasks",
        sa.Column("assigned_to_id", sa.Integer(), nullable=True),
    )
    op.add_column(
        "lead_tasks",
        sa.Column("created_by_id", sa.Integer(), nullable=True),
    )
    op.create_index(op.f("ix_lead_tasks_due_at"), "lead_tasks", ["due_at"])
    op.create_index(op.f("ix_lead_tasks_assigned_to_id"), "lead_tasks", ["assigned_to_id"])
    op.create_foreign_key(
        "fk_lead_tasks_assigned_to_id_sales_users",
        "lead_tasks",
        "sales_users",
        ["assigned_to_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        "fk_lead_tasks_created_by_id_sales_users",
        "lead_tasks",
        "sales_users",
        ["created_by_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.execute("UPDATE lead_tasks SET due_at = created_at WHERE due_at IS NULL")


def downgrade() -> None:
    op.drop_constraint("fk_lead_tasks_created_by_id_sales_users", "lead_tasks", type_="foreignkey")
    op.drop_constraint("fk_lead_tasks_assigned_to_id_sales_users", "lead_tasks", type_="foreignkey")
    op.drop_index(op.f("ix_lead_tasks_assigned_to_id"), table_name="lead_tasks")
    op.drop_index(op.f("ix_lead_tasks_due_at"), table_name="lead_tasks")
    op.drop_column("lead_tasks", "created_by_id")
    op.drop_column("lead_tasks", "assigned_to_id")
    op.drop_column("lead_tasks", "due_at")
    op.drop_column("lead_tasks", "result")
    op.drop_column("lead_tasks", "description")
    op.drop_column("lead_tasks", "priority")
    op.drop_column("lead_tasks", "task_type")
