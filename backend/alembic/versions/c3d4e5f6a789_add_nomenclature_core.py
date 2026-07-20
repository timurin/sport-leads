"""add nomenclature core and optional order item link

Revision ID: c3d4e5f6a789
Revises: a2b3c4d5e678
"""

import sqlalchemy as sa
from alembic import op

revision = "c3d4e5f6a789"
down_revision = "a2b3c4d5e678"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "nomenclatures",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("article", sa.String(length=100), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("short_name", sa.String(length=100), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("category", sa.String(length=100), nullable=False),
        sa.Column("unit", sa.String(length=30), nullable=False),
        sa.Column("base_price", sa.Numeric(14, 2), nullable=False),
        sa.Column("currency", sa.String(length=3), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("article", name="uq_nomenclatures_article"),
    )
    op.create_index("ix_nomenclatures_article", "nomenclatures", ["article"], unique=False)
    op.create_index("ix_nomenclatures_name", "nomenclatures", ["name"], unique=False)
    op.create_index("ix_nomenclatures_category", "nomenclatures", ["category"], unique=False)
    op.create_index("ix_nomenclatures_is_active", "nomenclatures", ["is_active"], unique=False)
    op.add_column("sales_order_items", sa.Column("nomenclature_id", sa.Integer(), nullable=True))
    op.create_index("ix_sales_order_items_nomenclature_id", "sales_order_items", ["nomenclature_id"], unique=False)
    op.create_foreign_key("fk_sales_order_items_nomenclature_id", "sales_order_items", "nomenclatures", ["nomenclature_id"], ["id"], ondelete="SET NULL")


def downgrade() -> None:
    op.drop_constraint("fk_sales_order_items_nomenclature_id", "sales_order_items", type_="foreignkey")
    op.drop_index("ix_sales_order_items_nomenclature_id", table_name="sales_order_items")
    op.drop_column("sales_order_items", "nomenclature_id")
    op.drop_index("ix_nomenclatures_is_active", table_name="nomenclatures")
    op.drop_index("ix_nomenclatures_category", table_name="nomenclatures")
    op.drop_index("ix_nomenclatures_name", table_name="nomenclatures")
    op.drop_index("ix_nomenclatures_article", table_name="nomenclatures")
    op.drop_table("nomenclatures")
