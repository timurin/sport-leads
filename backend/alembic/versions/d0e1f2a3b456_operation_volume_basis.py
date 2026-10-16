"""Accepted per-item volume basis; legacy/manual inputs remain unmarked.

Revision ID: d0e1f2a3b456
Revises: c9d0e1f2a345
"""
from alembic import op
import sqlalchemy as sa

revision = "d0e1f2a3b456"
down_revision = "c9d0e1f2a345"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("technical_card_operation_lines", sa.Column("volume_qty_per_item", sa.Numeric(14, 3), nullable=True))
    op.create_check_constraint("ck_tc_operation_volume_basis", "technical_card_operation_lines",
                               "volume_qty_per_item IS NULL OR volume_qty_per_item > 0")


def downgrade() -> None:
    op.drop_constraint("ck_tc_operation_volume_basis", "technical_card_operation_lines", type_="check")
    op.drop_column("technical_card_operation_lines", "volume_qty_per_item")
