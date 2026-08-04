"""Add sewing operation templates library (6.3.12).

Revision ID: b5c6d7e8f901
Revises: a4b5c6d7e890
Roadmap: 6.3.12.2
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "b5c6d7e8f901"
down_revision = "a4b5c6d7e890"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "sewing_operation_templates",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(length=255), nullable=False),
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
        sa.UniqueConstraint("name", name="uq_sewing_operation_templates_name"),
    )
    op.create_index(
        "ix_sewing_operation_templates_name",
        "sewing_operation_templates",
        ["name"],
    )

    op.create_table(
        "sewing_operation_template_lines",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "template_id",
            sa.Integer(),
            sa.ForeignKey("sewing_operation_templates.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "sewing_operation_id",
            sa.Integer(),
            sa.ForeignKey("sewing_operations.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("sequence", sa.Integer(), nullable=False),
        sa.CheckConstraint(
            "sequence >= 1",
            name="ck_sewing_operation_template_lines_sequence_positive",
        ),
        sa.UniqueConstraint(
            "template_id",
            "sequence",
            name="uq_sewing_operation_template_lines_template_sequence",
        ),
        sa.UniqueConstraint(
            "template_id",
            "sewing_operation_id",
            name="uq_sewing_operation_template_lines_template_op",
        ),
    )
    op.create_index(
        "ix_sewing_operation_template_lines_template_id",
        "sewing_operation_template_lines",
        ["template_id"],
    )
    op.create_index(
        "ix_sewing_operation_template_lines_sewing_operation_id",
        "sewing_operation_template_lines",
        ["sewing_operation_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_sewing_operation_template_lines_sewing_operation_id",
        table_name="sewing_operation_template_lines",
    )
    op.drop_index(
        "ix_sewing_operation_template_lines_template_id",
        table_name="sewing_operation_template_lines",
    )
    op.drop_table("sewing_operation_template_lines")
    op.drop_index(
        "ix_sewing_operation_templates_name",
        table_name="sewing_operation_templates",
    )
    op.drop_table("sewing_operation_templates")
