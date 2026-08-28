"""Standalone order groups + nullable TC SalesOrder FKs (Stage 28.2.1).

Revision ID: i8j9k0l1m234
Revises: h7i8j9k0l123
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "i8j9k0l1m234"
down_revision = "h7i8j9k0l123"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "technical_card_order_groups",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("order_number", sa.String(length=50), nullable=False),
        sa.Column("tech_cards_planned_count", sa.Integer(), nullable=False),
        sa.Column("desired_date", sa.Date(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.UniqueConstraint("order_number", name="uq_technical_card_order_groups_order_number"),
        sa.CheckConstraint(
            "tech_cards_planned_count >= 1",
            name="ck_technical_card_order_groups_planned_count",
        ),
    )
    op.add_column(
        "technical_cards",
        sa.Column("order_group_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_technical_cards_order_group_id",
        "technical_cards",
        "technical_card_order_groups",
        ["order_group_id"],
        ["id"],
        ondelete="RESTRICT",
    )
    op.alter_column(
        "technical_cards",
        "sales_order_id",
        existing_type=sa.Integer(),
        nullable=True,
    )
    op.alter_column(
        "technical_cards",
        "sales_order_item_id",
        existing_type=sa.Integer(),
        nullable=True,
    )
    op.create_check_constraint(
        "ck_technical_cards_contour_xor",
        "technical_cards",
        "("
        "(sales_order_id IS NOT NULL AND sales_order_item_id IS NOT NULL "
        "AND order_group_id IS NULL) OR "
        "(sales_order_id IS NULL AND sales_order_item_id IS NULL "
        "AND order_group_id IS NOT NULL)"
        ")",
    )
    op.create_index(
        "ix_technical_cards_order_group_id",
        "technical_cards",
        ["order_group_id"],
    )
    op.create_unique_constraint(
        "uq_technical_cards_group_card_seq",
        "technical_cards",
        ["order_group_id", "card_seq"],
    )


def downgrade() -> None:
    op.drop_constraint("uq_technical_cards_group_card_seq", "technical_cards", type_="unique")
    op.drop_index("ix_technical_cards_order_group_id", table_name="technical_cards")
    op.drop_constraint("ck_technical_cards_contour_xor", "technical_cards", type_="check")
    op.alter_column(
        "technical_cards",
        "sales_order_item_id",
        existing_type=sa.Integer(),
        nullable=False,
    )
    op.alter_column(
        "technical_cards",
        "sales_order_id",
        existing_type=sa.Integer(),
        nullable=False,
    )
    op.drop_constraint("fk_technical_cards_order_group_id", "technical_cards", type_="foreignkey")
    op.drop_column("technical_cards", "order_group_id")
    op.drop_table("technical_card_order_groups")
