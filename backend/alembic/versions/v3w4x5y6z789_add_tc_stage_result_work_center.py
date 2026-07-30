"""Add optional work center on technical card stage results.

Revision ID: v3w4x5y6z789
Revises: u2v3w4x5y678
Roadmap: 11.6.1
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "v3w4x5y6z789"
down_revision = "u2v3w4x5y678"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "technical_card_stage_results",
        sa.Column("work_center_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_technical_card_stage_results_work_center_id",
        "technical_card_stage_results",
        "work_centers",
        ["work_center_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        "ix_technical_card_stage_results_work_center_id",
        "technical_card_stage_results",
        ["work_center_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_technical_card_stage_results_work_center_id",
        table_name="technical_card_stage_results",
    )
    op.drop_constraint(
        "fk_technical_card_stage_results_work_center_id",
        "technical_card_stage_results",
        type_="foreignkey",
    )
    op.drop_column("technical_card_stage_results", "work_center_id")
