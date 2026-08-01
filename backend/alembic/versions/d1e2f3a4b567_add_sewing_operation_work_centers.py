"""Add sewing_operation_work_centers M:N link (roadmap 6.3.10.2).

Revision ID: d1e2f3a4b567
Revises: c0d1e2f3a456
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op


revision = "d1e2f3a4b567"
down_revision = "c0d1e2f3a456"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "sewing_operation_work_centers",
        sa.Column(
            "sewing_operation_id",
            sa.Integer(),
            sa.ForeignKey("sewing_operations.id", ondelete="CASCADE"),
            primary_key=True,
            nullable=False,
        ),
        sa.Column(
            "work_center_id",
            sa.Integer(),
            sa.ForeignKey("work_centers.id", ondelete="CASCADE"),
            primary_key=True,
            nullable=False,
        ),
    )
    op.create_index(
        "ix_sewing_operation_work_centers_work_center_id",
        "sewing_operation_work_centers",
        ["work_center_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_sewing_operation_work_centers_work_center_id",
        table_name="sewing_operation_work_centers",
    )
    op.drop_table("sewing_operation_work_centers")
