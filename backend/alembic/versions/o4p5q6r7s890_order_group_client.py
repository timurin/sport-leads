"""Nullable client on standalone tech-card order groups (26.3.7).

Revision ID: o4p5q6r7s890
Revises: n3o4p5q6r789
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "o4p5q6r7s890"
down_revision = "n3o4p5q6r789"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "technical_card_order_groups",
        sa.Column("client_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_technical_card_order_groups_client_id",
        "technical_card_order_groups",
        "clients",
        ["client_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        "ix_technical_card_order_groups_client_id",
        "technical_card_order_groups",
        ["client_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_technical_card_order_groups_client_id",
        table_name="technical_card_order_groups",
    )
    op.drop_constraint(
        "fk_technical_card_order_groups_client_id",
        "technical_card_order_groups",
        type_="foreignkey",
    )
    op.drop_column("technical_card_order_groups", "client_id")
