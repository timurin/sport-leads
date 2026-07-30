"""Add shop fact fields on technical card stage results.

Revision ID: u2v3w4x5y678
Revises: t1u2v3w4x567
Roadmap: 11.4.1 / 11.4.2
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "u2v3w4x5y678"
down_revision = "t1u2v3w4x567"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "technical_card_stage_results",
        sa.Column("work_done", sa.Text(), nullable=True),
    )
    op.add_column(
        "technical_card_stage_results",
        sa.Column("duration_seconds", sa.Integer(), nullable=True),
    )
    op.create_check_constraint(
        "ck_technical_card_stage_results_duration_seconds",
        "technical_card_stage_results",
        "duration_seconds IS NULL OR duration_seconds >= 0",
    )


def downgrade() -> None:
    op.drop_constraint(
        "ck_technical_card_stage_results_duration_seconds",
        "technical_card_stage_results",
        type_="check",
    )
    op.drop_column("technical_card_stage_results", "duration_seconds")
    op.drop_column("technical_card_stage_results", "work_done")
