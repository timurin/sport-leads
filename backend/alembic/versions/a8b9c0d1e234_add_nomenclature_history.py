"""Add nomenclature_history table (roadmap 4.3.3.1).

Revision ID: a8b9c0d1e234
Revises: z7a8b9c0d123
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op


revision = "a8b9c0d1e234"
down_revision = "z7a8b9c0d123"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "nomenclature_history",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("nomenclature_id", sa.Integer(), nullable=False),
        sa.Column("actor", sa.String(length=255), nullable=False, server_default="Система"),
        sa.Column("action", sa.String(length=500), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.ForeignKeyConstraint(
            ["nomenclature_id"],
            ["nomenclatures.id"],
            ondelete="CASCADE",
        ),
    )
    op.create_index(
        "ix_nomenclature_history_nomenclature_id",
        "nomenclature_history",
        ["nomenclature_id"],
    )
    op.create_index(
        "ix_nomenclature_history_created_at",
        "nomenclature_history",
        ["created_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_nomenclature_history_created_at", table_name="nomenclature_history")
    op.drop_index(
        "ix_nomenclature_history_nomenclature_id", table_name="nomenclature_history"
    )
    op.drop_table("nomenclature_history")
