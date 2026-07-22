"""add sewing_operation_id on assembly operation lines

Revision ID: r8s9t0u1v234
Revises: q7r8s9t0u123
"""

import sqlalchemy as sa
from alembic import op


revision = "r8s9t0u1v234"
down_revision = "q7r8s9t0u123"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "assembly_operation_lines",
        sa.Column("sewing_operation_id", sa.Integer(), nullable=True),
    )
    op.create_index(
        "ix_assembly_operation_lines_sewing_operation_id",
        "assembly_operation_lines",
        ["sewing_operation_id"],
    )
    op.create_foreign_key(
        "fk_assembly_operation_lines_sewing_operation_id",
        "assembly_operation_lines",
        "sewing_operations",
        ["sewing_operation_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_assembly_operation_lines_sewing_operation_id",
        "assembly_operation_lines",
        type_="foreignkey",
    )
    op.drop_index(
        "ix_assembly_operation_lines_sewing_operation_id",
        table_name="assembly_operation_lines",
    )
    op.drop_column("assembly_operation_lines", "sewing_operation_id")
