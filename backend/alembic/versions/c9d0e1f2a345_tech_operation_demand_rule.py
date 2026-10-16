"""Explicit TechOperation time-demand rule; legacy operations remain unset.

Revision ID: c9d0e1f2a345
Revises: b8c9d0e1f234
"""
from alembic import op
import sqlalchemy as sa

revision = "c9d0e1f2a345"
down_revision = "b8c9d0e1f234"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("tech_operations", sa.Column("demand_rule", sa.String(32), nullable=True))
    op.add_column("tech_operations", sa.Column("demand_duration_seconds", sa.Integer(), nullable=True))
    op.create_check_constraint("ck_tech_operations_demand_rule", "tech_operations", "demand_rule IS NULL OR demand_rule IN ('fixed_per_order', 'per_item')")
    op.create_check_constraint("ck_tech_operations_demand_duration", "tech_operations", "demand_duration_seconds IS NULL OR demand_duration_seconds > 0")


def downgrade() -> None:
    op.drop_constraint("ck_tech_operations_demand_duration", "tech_operations", type_="check")
    op.drop_constraint("ck_tech_operations_demand_rule", "tech_operations", type_="check")
    op.drop_column("tech_operations", "demand_duration_seconds")
    op.drop_column("tech_operations", "demand_rule")
