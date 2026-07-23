"""Add duration_seconds to sewing operations and assembly lines.

Revision ID: d5e6f7a8b901
Revises: b2c3d4e5f678

Catalog field is normative time in seconds; assembly lines snapshot
the value on copy-on-pick (same pattern as cost).
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "d5e6f7a8b901"
down_revision = "b2c3d4e5f678"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "sewing_operations",
        sa.Column(
            "duration_seconds",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
    )
    op.create_check_constraint(
        "ck_sewing_operations_duration_seconds_non_negative",
        "sewing_operations",
        "duration_seconds >= 0",
    )

    op.add_column(
        "assembly_operation_lines",
        sa.Column(
            "duration_seconds",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
    )
    op.create_check_constraint(
        "ck_assembly_operation_lines_duration_seconds",
        "assembly_operation_lines",
        "duration_seconds >= 0",
    )


def downgrade() -> None:
    op.drop_constraint(
        "ck_assembly_operation_lines_duration_seconds",
        "assembly_operation_lines",
        type_="check",
    )
    op.drop_column("assembly_operation_lines", "duration_seconds")

    op.drop_constraint(
        "ck_sewing_operations_duration_seconds_non_negative",
        "sewing_operations",
        type_="check",
    )
    op.drop_column("sewing_operations", "duration_seconds")
