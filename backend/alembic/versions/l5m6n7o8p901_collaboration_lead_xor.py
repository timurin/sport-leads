"""Collaboration thread XOR lead_id | sales_order_id (ADR-027 / 20.3.2).

Revision ID: l5m6n7o8p901
Revises: k4l5m6n7o890
Create Date: 2026-08-05 19:20:00.000000

"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "l5m6n7o8p901"
down_revision: Union[str, Sequence[str], None] = "k4l5m6n7o890"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "collaboration_threads",
        sa.Column("lead_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_collaboration_threads_lead_id_leads",
        "collaboration_threads",
        "leads",
        ["lead_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.alter_column(
        "collaboration_threads",
        "sales_order_id",
        existing_type=sa.Integer(),
        nullable=True,
    )
    op.create_index(
        "ix_collaboration_threads_lead_id",
        "collaboration_threads",
        ["lead_id"],
        unique=True,
    )
    op.create_check_constraint(
        "ck_collaboration_threads_anchor_xor",
        "collaboration_threads",
        "(sales_order_id IS NOT NULL AND lead_id IS NULL) "
        "OR (sales_order_id IS NULL AND lead_id IS NOT NULL)",
    )

    op.add_column(
        "collaboration_microtasks",
        sa.Column("lead_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_collaboration_microtasks_lead_id_leads",
        "collaboration_microtasks",
        "leads",
        ["lead_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_index(
        "ix_collaboration_microtasks_lead_id",
        "collaboration_microtasks",
        ["lead_id"],
        unique=False,
    )
    op.alter_column(
        "collaboration_microtasks",
        "sales_order_id",
        existing_type=sa.Integer(),
        nullable=True,
    )
    op.create_check_constraint(
        "ck_collaboration_microtasks_anchor_xor",
        "collaboration_microtasks",
        "(sales_order_id IS NOT NULL AND lead_id IS NULL) "
        "OR (sales_order_id IS NULL AND lead_id IS NOT NULL)",
    )

    op.add_column(
        "collaboration_notifications",
        sa.Column("lead_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_collaboration_notifications_lead_id_leads",
        "collaboration_notifications",
        "leads",
        ["lead_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_index(
        "ix_collaboration_notifications_lead_id",
        "collaboration_notifications",
        ["lead_id"],
        unique=False,
    )
    op.alter_column(
        "collaboration_notifications",
        "sales_order_id",
        existing_type=sa.Integer(),
        nullable=True,
    )
    op.create_check_constraint(
        "ck_collaboration_notifications_anchor_xor",
        "collaboration_notifications",
        "(sales_order_id IS NOT NULL AND lead_id IS NULL) "
        "OR (sales_order_id IS NULL AND lead_id IS NOT NULL)",
    )


def downgrade() -> None:
    op.drop_constraint(
        "ck_collaboration_notifications_anchor_xor",
        "collaboration_notifications",
        type_="check",
    )
    op.drop_index(
        "ix_collaboration_notifications_lead_id",
        table_name="collaboration_notifications",
    )
    op.drop_constraint(
        "fk_collaboration_notifications_lead_id_leads",
        "collaboration_notifications",
        type_="foreignkey",
    )
    op.execute(
        "DELETE FROM collaboration_notifications WHERE sales_order_id IS NULL"
    )
    op.alter_column(
        "collaboration_notifications",
        "sales_order_id",
        existing_type=sa.Integer(),
        nullable=False,
    )
    op.drop_column("collaboration_notifications", "lead_id")

    op.drop_constraint(
        "ck_collaboration_microtasks_anchor_xor",
        "collaboration_microtasks",
        type_="check",
    )
    op.drop_index(
        "ix_collaboration_microtasks_lead_id",
        table_name="collaboration_microtasks",
    )
    op.drop_constraint(
        "fk_collaboration_microtasks_lead_id_leads",
        "collaboration_microtasks",
        type_="foreignkey",
    )
    op.execute("DELETE FROM collaboration_microtasks WHERE sales_order_id IS NULL")
    op.alter_column(
        "collaboration_microtasks",
        "sales_order_id",
        existing_type=sa.Integer(),
        nullable=False,
    )
    op.drop_column("collaboration_microtasks", "lead_id")

    op.drop_constraint(
        "ck_collaboration_threads_anchor_xor",
        "collaboration_threads",
        type_="check",
    )
    op.drop_index("ix_collaboration_threads_lead_id", table_name="collaboration_threads")
    op.drop_constraint(
        "fk_collaboration_threads_lead_id_leads",
        "collaboration_threads",
        type_="foreignkey",
    )
    op.execute("DELETE FROM collaboration_threads WHERE sales_order_id IS NULL")
    op.alter_column(
        "collaboration_threads",
        "sales_order_id",
        existing_type=sa.Integer(),
        nullable=False,
    )
    op.drop_column("collaboration_threads", "lead_id")
