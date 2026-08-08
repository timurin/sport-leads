"""Add work_tasks.created_by_platform_user_id (Назначил).

Revision ID: r2s3t4u5v678
Revises: q1r2s3t4u567
Create Date: 2026-08-08
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "r2s3t4u5v678"
down_revision: Union[str, Sequence[str], None] = "q1r2s3t4u567"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "work_tasks",
        sa.Column("created_by_platform_user_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_work_tasks_created_by_platform_user_id",
        "work_tasks",
        "platform_users",
        ["created_by_platform_user_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        "ix_work_tasks_created_by_platform_user_id",
        "work_tasks",
        ["created_by_platform_user_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_work_tasks_created_by_platform_user_id",
        table_name="work_tasks",
    )
    op.drop_constraint(
        "fk_work_tasks_created_by_platform_user_id",
        "work_tasks",
        type_="foreignkey",
    )
    op.drop_column("work_tasks", "created_by_platform_user_id")
