"""Add work_task_board_stages + work_tasks.board_stage_id (23.8).

Revision ID: q1r2s3t4u567
Revises: p9q0r1s2t345
Create Date: 2026-08-08
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "q1r2s3t4u567"
down_revision: Union[str, Sequence[str], None] = "p9q0r1s2t345"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_SEED = (
    ("Бэклог", 10),
    ("В работе", 20),
    ("На проверке", 30),
    ("Готово", 40),
)


def upgrade() -> None:
    op.create_table(
        "work_task_board_stages",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
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
        sa.UniqueConstraint("name", name="uq_work_task_board_stages_name"),
    )
    op.create_index(
        "ix_work_task_board_stages_sort_order",
        "work_task_board_stages",
        ["sort_order"],
    )

    stages = sa.table(
        "work_task_board_stages",
        sa.column("name", sa.String),
        sa.column("sort_order", sa.Integer),
        sa.column("is_active", sa.Boolean),
    )
    op.bulk_insert(
        stages,
        [
            {"name": name, "sort_order": order, "is_active": True}
            for name, order in _SEED
        ],
    )

    op.add_column(
        "work_tasks",
        sa.Column("board_stage_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_work_tasks_board_stage_id",
        "work_tasks",
        "work_task_board_stages",
        ["board_stage_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        "ix_work_tasks_board_stage_id",
        "work_tasks",
        ["board_stage_id"],
    )

    # Assign existing tasks to first seed stage (Бэклог).
    op.execute(
        sa.text(
            """
            UPDATE work_tasks
            SET board_stage_id = (
              SELECT id FROM work_task_board_stages
              WHERE name = 'Бэклог'
              ORDER BY id
              LIMIT 1
            )
            WHERE board_stage_id IS NULL
            """
        )
    )


def downgrade() -> None:
    op.drop_index("ix_work_tasks_board_stage_id", table_name="work_tasks")
    op.drop_constraint("fk_work_tasks_board_stage_id", "work_tasks", type_="foreignkey")
    op.drop_column("work_tasks", "board_stage_id")
    op.drop_index(
        "ix_work_task_board_stages_sort_order",
        table_name="work_task_board_stages",
    )
    op.drop_table("work_task_board_stages")
