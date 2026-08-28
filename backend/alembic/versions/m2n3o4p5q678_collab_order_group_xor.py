"""Collaboration thread XOR + order_group_id for standalone TC (28.5.4).

Revision ID: m2n3o4p5q678
Revises: l1m2n3o4p567
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "m2n3o4p5q678"
down_revision = "l1m2n3o4p567"
branch_labels = None
depends_on = None

_TRIPLE_XOR = (
    "("
    "(sales_order_id IS NOT NULL AND lead_id IS NULL AND order_group_id IS NULL) OR "
    "(sales_order_id IS NULL AND lead_id IS NOT NULL AND order_group_id IS NULL) OR "
    "(sales_order_id IS NULL AND lead_id IS NULL AND order_group_id IS NOT NULL)"
    ")"
)

_DUAL_XOR = (
    "(sales_order_id IS NOT NULL AND lead_id IS NULL) "
    "OR (sales_order_id IS NULL AND lead_id IS NOT NULL)"
)


def upgrade() -> None:
    op.add_column(
        "collaboration_threads",
        sa.Column("order_group_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_collaboration_threads_order_group_id",
        "collaboration_threads",
        "technical_card_order_groups",
        ["order_group_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_unique_constraint(
        "uq_collaboration_threads_order_group_id",
        "collaboration_threads",
        ["order_group_id"],
    )
    op.create_index(
        "ix_collaboration_threads_order_group_id",
        "collaboration_threads",
        ["order_group_id"],
    )
    op.drop_constraint(
        "ck_collaboration_threads_anchor_xor",
        "collaboration_threads",
        type_="check",
    )
    op.create_check_constraint(
        "ck_collaboration_threads_anchor_xor",
        "collaboration_threads",
        _TRIPLE_XOR,
    )

    op.add_column(
        "collaboration_notifications",
        sa.Column("order_group_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_collaboration_notifications_order_group_id",
        "collaboration_notifications",
        "technical_card_order_groups",
        ["order_group_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_index(
        "ix_collaboration_notifications_order_group_id",
        "collaboration_notifications",
        ["order_group_id"],
    )
    op.drop_constraint(
        "ck_collaboration_notifications_anchor_xor",
        "collaboration_notifications",
        type_="check",
    )
    op.create_check_constraint(
        "ck_collaboration_notifications_anchor_xor",
        "collaboration_notifications",
        _TRIPLE_XOR,
    )


def downgrade() -> None:
    op.drop_constraint(
        "ck_collaboration_notifications_anchor_xor",
        "collaboration_notifications",
        type_="check",
    )
    op.create_check_constraint(
        "ck_collaboration_notifications_anchor_xor",
        "collaboration_notifications",
        _DUAL_XOR,
    )
    op.drop_index(
        "ix_collaboration_notifications_order_group_id",
        table_name="collaboration_notifications",
    )
    op.drop_constraint(
        "fk_collaboration_notifications_order_group_id",
        "collaboration_notifications",
        type_="foreignkey",
    )
    op.drop_column("collaboration_notifications", "order_group_id")

    op.drop_constraint(
        "ck_collaboration_threads_anchor_xor",
        "collaboration_threads",
        type_="check",
    )
    op.create_check_constraint(
        "ck_collaboration_threads_anchor_xor",
        "collaboration_threads",
        _DUAL_XOR,
    )
    op.drop_index(
        "ix_collaboration_threads_order_group_id",
        table_name="collaboration_threads",
    )
    op.drop_constraint(
        "uq_collaboration_threads_order_group_id",
        "collaboration_threads",
        type_="unique",
    )
    op.drop_constraint(
        "fk_collaboration_threads_order_group_id",
        "collaboration_threads",
        type_="foreignkey",
    )
    op.drop_column("collaboration_threads", "order_group_id")
