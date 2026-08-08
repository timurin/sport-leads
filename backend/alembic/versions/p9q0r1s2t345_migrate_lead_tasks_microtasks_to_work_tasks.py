"""Migrate LeadTask + CollaborationMicrotask into WorkTask (23.6.1 / ADR-028).

Revision ID: p9q0r1s2t345
Revises: o8p9q0r1s234
Create Date: 2026-08-08
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.orm import Session

revision: str = "p9q0r1s2t345"
down_revision: Union[str, Sequence[str], None] = "o8p9q0r1s234"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "work_task_migration_map",
        sa.Column("source_kind", sa.String(length=40), nullable=False),
        sa.Column("source_id", sa.Integer(), nullable=False),
        sa.Column("work_task_id", sa.Integer(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(
            ["work_task_id"],
            ["work_tasks.id"],
            name="fk_work_task_migration_map_work_task_id",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint(
            "source_kind",
            "source_id",
            name="pk_work_task_migration_map",
        ),
        sa.UniqueConstraint(
            "work_task_id",
            name="uq_work_task_migration_map_work_task_id",
        ),
    )

    bind = op.get_bind()
    session = Session(bind=bind)
    try:
        from app.services.work_task_migration import run_work_task_data_migration

        run_work_task_data_migration(session)
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def downgrade() -> None:
    bind = op.get_bind()
    session = Session(bind=bind)
    try:
        from app.services.work_task_migration import revert_work_task_data_migration

        revert_work_task_data_migration(session)
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()

    op.drop_table("work_task_migration_map")
