"""Align TC unit-line size_type to male/female (9.3.2.5).

Revision ID: o2p3q4r5s678
Revises: n1c2d3e4f567
Roadmap: 9.3.2.5
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "o2p3q4r5s678"
down_revision = "n1c2d3e4f567"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        sa.text(
            """
            UPDATE technical_card_unit_lines
            SET size_type = CASE size_type
                WHEN 'men' THEN 'male'
                WHEN 'women' THEN 'female'
                WHEN 'male' THEN 'male'
                WHEN 'female' THEN 'female'
                ELSE NULL
            END
            """
        )
    )
    op.drop_constraint(
        "ck_technical_card_unit_lines_size_type",
        "technical_card_unit_lines",
        type_="check",
    )
    op.create_check_constraint(
        "ck_technical_card_unit_lines_size_type",
        "technical_card_unit_lines",
        "size_type IS NULL OR size_type IN ('male', 'female')",
    )


def downgrade() -> None:
    op.execute(
        sa.text(
            """
            UPDATE technical_card_unit_lines
            SET size_type = CASE size_type
                WHEN 'male' THEN 'men'
                WHEN 'female' THEN 'women'
                ELSE NULL
            END
            """
        )
    )
    op.drop_constraint(
        "ck_technical_card_unit_lines_size_type",
        "technical_card_unit_lines",
        type_="check",
    )
    op.create_check_constraint(
        "ck_technical_card_unit_lines_size_type",
        "technical_card_unit_lines",
        "size_type IS NULL OR size_type IN ('men', 'women', 'kids')",
    )
