"""ONE OF template/snapshot metadata and mutable card selections.

Revision ID: b8c9d0e1f234
Revises: a7b8c9d0e123
"""
from alembic import op
import sqlalchemy as sa

revision = "b8c9d0e1f234"
down_revision = "a7b8c9d0e123"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("shop_routing_templates", sa.Column("route_variant_groups", sa.JSON(), nullable=False, server_default="[]"))
    op.add_column("technical_cards", sa.Column("route_variant_groups", sa.JSON(), nullable=False, server_default="[]"))
    op.add_column("technical_cards", sa.Column("route_variant_selections", sa.JSON(), nullable=False, server_default="{}"))


def downgrade() -> None:
    op.drop_column("technical_cards", "route_variant_selections")
    op.drop_column("technical_cards", "route_variant_groups")
    op.drop_column("shop_routing_templates", "route_variant_groups")
