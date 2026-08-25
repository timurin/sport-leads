"""Add sewing work ledger entries (24.2.1).

Revision ID: c2d3e4f5a678
Revises: z0a1b2c3d456
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "c2d3e4f5a678"
down_revision = "z0a1b2c3d456"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "sewing_work_ledger_entries",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "platform_user_id",
            sa.Integer(),
            sa.ForeignKey("platform_users.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "technical_card_id",
            sa.Integer(),
            sa.ForeignKey("technical_cards.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("kind", sa.String(length=20), nullable=False),
        sa.Column(
            "operation_line_id",
            sa.Integer(),
            sa.ForeignKey("technical_card_operation_lines.id", ondelete="RESTRICT"),
            nullable=True,
        ),
        sa.Column("qty", sa.Numeric(14, 3), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("unit_price", sa.Numeric(14, 2), nullable=False),
        sa.Column("price_label", sa.String(length=255), nullable=False),
        sa.Column(
            "taken_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("released_at", sa.DateTime(timezone=True), nullable=True),
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
        sa.CheckConstraint("kind IN ('piece', 'operation')", name="ck_swle_kind"),
        sa.CheckConstraint(
            "status IN ('reserved', 'completed', 'released')",
            name="ck_swle_status",
        ),
        sa.CheckConstraint("qty > 0", name="ck_swle_qty_positive"),
        sa.CheckConstraint("unit_price >= 0", name="ck_swle_unit_price_non_negative"),
        sa.CheckConstraint(
            "(kind = 'piece' AND operation_line_id IS NULL) OR "
            "(kind = 'operation' AND operation_line_id IS NOT NULL)",
            name="ck_swle_kind_operation_line",
        ),
        sa.CheckConstraint(
            "(status = 'reserved' AND completed_at IS NULL AND released_at IS NULL) OR "
            "(status = 'completed' AND completed_at IS NOT NULL AND released_at IS NULL) OR "
            "(status = 'released' AND released_at IS NOT NULL AND completed_at IS NULL)",
            name="ck_swle_status_timestamps",
        ),
    )
    op.create_index("ix_swle_platform_user_id", "sewing_work_ledger_entries", ["platform_user_id"])
    op.create_index(
        "ix_swle_technical_card_id",
        "sewing_work_ledger_entries",
        ["technical_card_id"],
    )
    op.create_index(
        "ix_swle_user_status",
        "sewing_work_ledger_entries",
        ["platform_user_id", "status"],
    )
    op.create_index(
        "ix_swle_card_kind_status",
        "sewing_work_ledger_entries",
        ["technical_card_id", "kind", "status"],
    )
    op.create_index(
        "ix_swle_operation_line_id",
        "sewing_work_ledger_entries",
        ["operation_line_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_swle_operation_line_id", table_name="sewing_work_ledger_entries")
    op.drop_index("ix_swle_card_kind_status", table_name="sewing_work_ledger_entries")
    op.drop_index("ix_swle_user_status", table_name="sewing_work_ledger_entries")
    op.drop_index("ix_swle_technical_card_id", table_name="sewing_work_ledger_entries")
    op.drop_index("ix_swle_platform_user_id", table_name="sewing_work_ledger_entries")
    op.drop_table("sewing_work_ledger_entries")
