"""Amend TC composition: planned_qty, fact_qty, production_stage_id.

Revision ID: r9s0t1u2v345
Revises: q8r9s0t1u234
Roadmap: 9.3.4.1 / ADR-016 plan-fact materials
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "r9s0t1u2v345"
down_revision = "q8r9s0t1u234"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_constraint(
        "ck_technical_card_composition_lines_quantity",
        "technical_card_composition_lines",
        type_="check",
    )
    op.alter_column(
        "technical_card_composition_lines",
        "quantity",
        new_column_name="planned_qty",
        existing_type=sa.Numeric(14, 3),
        existing_nullable=True,
    )
    op.create_check_constraint(
        "ck_technical_card_composition_lines_planned_qty",
        "technical_card_composition_lines",
        "planned_qty IS NULL OR planned_qty >= 0",
    )

    op.add_column(
        "technical_card_composition_lines",
        sa.Column("fact_qty", sa.Numeric(14, 3), nullable=True),
    )
    op.create_check_constraint(
        "ck_technical_card_composition_lines_fact_qty",
        "technical_card_composition_lines",
        "fact_qty IS NULL OR fact_qty >= 0",
    )

    op.add_column(
        "technical_card_composition_lines",
        sa.Column("production_stage_id", sa.Integer(), nullable=True),
    )
    op.create_index(
        "ix_technical_card_composition_lines_production_stage_id",
        "technical_card_composition_lines",
        ["production_stage_id"],
    )
    op.create_foreign_key(
        "fk_technical_card_composition_lines_production_stage_id",
        "technical_card_composition_lines",
        "production_stages",
        ["production_stage_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_technical_card_composition_lines_production_stage_id",
        "technical_card_composition_lines",
        type_="foreignkey",
    )
    op.drop_index(
        "ix_technical_card_composition_lines_production_stage_id",
        table_name="technical_card_composition_lines",
    )
    op.drop_column("technical_card_composition_lines", "production_stage_id")

    op.drop_constraint(
        "ck_technical_card_composition_lines_fact_qty",
        "technical_card_composition_lines",
        type_="check",
    )
    op.drop_column("technical_card_composition_lines", "fact_qty")

    op.drop_constraint(
        "ck_technical_card_composition_lines_planned_qty",
        "technical_card_composition_lines",
        type_="check",
    )
    op.alter_column(
        "technical_card_composition_lines",
        "planned_qty",
        new_column_name="quantity",
        existing_type=sa.Numeric(14, 3),
        existing_nullable=True,
    )
    op.create_check_constraint(
        "ck_technical_card_composition_lines_quantity",
        "technical_card_composition_lines",
        "quantity IS NULL OR quantity >= 0",
    )
