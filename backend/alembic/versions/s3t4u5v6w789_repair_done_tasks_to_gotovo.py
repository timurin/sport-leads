"""Repair done work tasks onto board stage Готово.

Revision ID: s3t4u5v6w789
Revises: r2s3t4u5v678
Create Date: 2026-08-10
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "s3t4u5v6w789"
down_revision: Union[str, Sequence[str], None] = "r2s3t4u5v678"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    done_id = conn.execute(
        sa.text(
            "SELECT id FROM work_task_board_stages "
            "WHERE name = 'Готово' AND is_active IS TRUE "
            "ORDER BY sort_order ASC, id ASC LIMIT 1"
        )
    ).scalar()
    if done_id is None:
        return
    conn.execute(
        sa.text(
            "UPDATE work_tasks "
            "SET board_stage_id = :done_id, updated_at = NOW() "
            "WHERE status = 'done' "
            "AND (board_stage_id IS DISTINCT FROM :done_id)"
        ),
        {"done_id": done_id},
    )


def downgrade() -> None:
    # Irreversible data repair.
    pass
