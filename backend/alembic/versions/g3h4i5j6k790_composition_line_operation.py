"""Bind composition material lines to the consuming operation.

Revision ID: g3h4i5j6k790
Revises: f2a3b4c5d678
"""
from alembic import op
import sqlalchemy as sa

revision = "g3h4i5j6k790"
down_revision = "f2a3b4c5d678"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "technical_card_composition_lines",
        sa.Column("tech_operation_id", sa.Integer(), nullable=True),
    )
    op.create_index(
        "ix_technical_card_composition_lines_tech_operation_id",
        "technical_card_composition_lines",
        ["tech_operation_id"],
    )
    op.execute(
        """
        UPDATE technical_card_composition_lines AS line
        SET tech_operation_id = matched.tech_operation_id
        FROM (
            SELECT line_row.id AS line_id, MIN(required.tech_operation_id) AS tech_operation_id
            FROM technical_card_composition_lines AS line_row
            JOIN technical_card_stage_results AS stage
              ON stage.technical_card_id = line_row.technical_card_id
             AND stage.production_stage_id = line_row.production_stage_id
            JOIN tech_operation_required_materials AS required
              ON required.tech_operation_id = stage.tech_operation_id
             AND required.nomenclature_id = line_row.nomenclature_id
            WHERE line_row.line_kind = 'material'
              AND line_row.tech_operation_id IS NULL
            GROUP BY line_row.id
            HAVING COUNT(DISTINCT required.tech_operation_id) = 1
        ) AS matched
        WHERE line.id = matched.line_id
        """
    )


def downgrade() -> None:
    op.drop_index(
        "ix_technical_card_composition_lines_tech_operation_id",
        table_name="technical_card_composition_lines",
    )
    op.drop_column("technical_card_composition_lines", "tech_operation_id")
