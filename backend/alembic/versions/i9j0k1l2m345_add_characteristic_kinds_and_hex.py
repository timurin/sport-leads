"""add characteristic kinds and color option hex values

Revision ID: i9j0k1l2m345
Revises: h8c9d0e1f234
"""
import sqlalchemy as sa
from alembic import op


revision = "i9j0k1l2m345"
down_revision = "h8c9d0e1f234"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("characteristic_definitions", sa.Column("kind", sa.String(20), nullable=False, server_default="LIST"))
    op.create_index("ix_characteristic_definitions_kind", "characteristic_definitions", ["kind"])
    op.add_column("characteristic_options", sa.Column("hex_value", sa.String(7), nullable=True))
    op.execute(sa.text("INSERT INTO characteristic_definitions (code, name, kind, is_active) VALUES ('color', 'Цвет', 'COLOR', true) ON CONFLICT (code) DO NOTHING"))
    op.execute(sa.text("INSERT INTO characteristic_definitions (code, name, kind, is_active) VALUES ('size', 'Размер', 'LIST', true) ON CONFLICT (code) DO NOTHING"))


def downgrade() -> None:
    op.drop_column("characteristic_options", "hex_value")
    op.drop_index("ix_characteristic_definitions_kind", table_name="characteristic_definitions")
    op.drop_column("characteristic_definitions", "kind")
