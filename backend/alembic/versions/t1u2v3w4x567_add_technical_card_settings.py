"""Add technical card settings singleton.

Revision ID: t1u2v3w4x567
Revises: s0t1u2v3w456
Roadmap: 9.6.2
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "t1u2v3w4x567"
down_revision = "s0t1u2v3w456"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "technical_card_settings",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("eligible_nomenclature_types", sa.String(length=120), nullable=False),
        sa.Column("numbering_template", sa.String(length=120), nullable=False),
        sa.Column("unit_field_size_type_enabled", sa.Boolean(), nullable=False),
        sa.Column("unit_field_size_enabled", sa.Boolean(), nullable=False),
        sa.Column("unit_field_personalization_enabled", sa.Boolean(), nullable=False),
        sa.Column("unit_field_print_number_enabled", sa.Boolean(), nullable=False),
        sa.Column("unit_field_notes_enabled", sa.Boolean(), nullable=False),
        sa.Column("stage_label_binding_mode", sa.String(length=30), nullable=False),
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
        sa.CheckConstraint("id = 1", name="ck_technical_card_settings_singleton_id"),
        sa.CheckConstraint(
            "stage_label_binding_mode IN ('snapshot')",
            name="ck_technical_card_settings_stage_label_binding_mode",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.execute(
        sa.text(
            """
            INSERT INTO technical_card_settings (
                id,
                eligible_nomenclature_types,
                numbering_template,
                unit_field_size_type_enabled,
                unit_field_size_enabled,
                unit_field_personalization_enabled,
                unit_field_print_number_enabled,
                unit_field_notes_enabled,
                stage_label_binding_mode
            ) VALUES (
                1,
                'PRODUCT',
                '{orderNo}-{cardSeq}',
                TRUE,
                TRUE,
                TRUE,
                TRUE,
                TRUE,
                'snapshot'
            )
            """
        )
    )


def downgrade() -> None:
    op.drop_table("technical_card_settings")
