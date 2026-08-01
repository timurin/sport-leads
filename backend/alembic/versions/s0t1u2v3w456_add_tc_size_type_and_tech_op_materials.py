"""Add TC unit-line size_type and TechOperation required materials.

Revision ID: s0t1u2v3w456
Revises: r9s0t1u2v345
Roadmap: 8.1.4 / 9.3.2.6 / 9.3.5
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "s0t1u2v3w456"
down_revision = "r9s0t1u2v345"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "technical_card_unit_lines",
        sa.Column("size_type", sa.String(length=20), nullable=True),
    )
    op.create_check_constraint(
        "ck_technical_card_unit_lines_size_type",
        "technical_card_unit_lines",
        "size_type IS NULL OR size_type IN ('men', 'women', 'kids')",
    )

    op.create_table(
        "tech_operation_required_materials",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("tech_operation_id", sa.Integer(), nullable=False),
        sa.Column("nomenclature_id", sa.Integer(), nullable=False),
        sa.Column("quantity", sa.Numeric(14, 3), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "quantity >= 0",
            name="ck_tech_operation_required_materials_quantity_nonnegative",
        ),
        sa.ForeignKeyConstraint(
            ["tech_operation_id"],
            ["tech_operations.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["nomenclature_id"],
            ["nomenclatures.id"],
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "tech_operation_id",
            "nomenclature_id",
            name="uq_tech_operation_required_materials_pair",
        ),
    )
    op.create_index(
        "ix_tech_operation_required_materials_tech_operation_id",
        "tech_operation_required_materials",
        ["tech_operation_id"],
    )
    op.create_index(
        "ix_tech_operation_required_materials_nomenclature_id",
        "tech_operation_required_materials",
        ["nomenclature_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_tech_operation_required_materials_nomenclature_id",
        table_name="tech_operation_required_materials",
    )
    op.drop_index(
        "ix_tech_operation_required_materials_tech_operation_id",
        table_name="tech_operation_required_materials",
    )
    op.drop_table("tech_operation_required_materials")

    op.drop_constraint(
        "ck_technical_card_unit_lines_size_type",
        "technical_card_unit_lines",
        type_="check",
    )
    op.drop_column("technical_card_unit_lines", "size_type")
