"""add characteristics and nomenclature variants

Revision ID: g7b8c9d0e123
Revises: f6a7b8c9d012
"""
import sqlalchemy as sa
from alembic import op

revision = "g7b8c9d0e123"
down_revision = "f6a7b8c9d012"
branch_labels = None
depends_on = None


def _timestamps():
    return [
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    ]


def upgrade() -> None:
    op.create_table("characteristic_definitions",
        sa.Column("id", sa.Integer(), primary_key=True), sa.Column("code", sa.String(100), nullable=False),
        sa.Column("name", sa.String(255), nullable=False), sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        *_timestamps(), sa.UniqueConstraint("code", name="uq_characteristic_definitions_code"))
    op.create_index("ix_characteristic_definitions_code", "characteristic_definitions", ["code"])
    op.create_index("ix_characteristic_definitions_name", "characteristic_definitions", ["name"])
    op.create_index("ix_characteristic_definitions_is_active", "characteristic_definitions", ["is_active"])
    op.create_table("characteristic_options",
        sa.Column("id", sa.Integer(), primary_key=True), sa.Column("characteristic_id", sa.Integer(), nullable=False),
        sa.Column("code", sa.String(100), nullable=False), sa.Column("label", sa.String(255), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"), sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        *_timestamps(), sa.ForeignKeyConstraint(["characteristic_id"], ["characteristic_definitions.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("characteristic_id", "code", name="uq_characteristic_options_definition_code"))
    op.create_index("ix_characteristic_options_characteristic_id", "characteristic_options", ["characteristic_id"])
    op.create_index("ix_characteristic_options_is_active", "characteristic_options", ["is_active"])
    op.create_table("category_characteristics",
        sa.Column("id", sa.Integer(), primary_key=True), sa.Column("category_id", sa.Integer(), nullable=False),
        sa.Column("characteristic_id", sa.Integer(), nullable=False), sa.Column("is_required", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("inherit", sa.Boolean(), nullable=False, server_default=sa.true()), sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        *_timestamps(), sa.ForeignKeyConstraint(["category_id"], ["nomenclature_categories.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["characteristic_id"], ["characteristic_definitions.id"], ondelete="RESTRICT"),
        sa.UniqueConstraint("category_id", "characteristic_id", name="uq_category_characteristics_pair"),
        sa.CheckConstraint("sort_order >= 0", name="ck_category_characteristics_sort_order"))
    op.create_index("ix_category_characteristics_category_id", "category_characteristics", ["category_id"])
    op.create_index("ix_category_characteristics_characteristic_id", "category_characteristics", ["characteristic_id"])
    op.create_table("nomenclature_characteristics",
        sa.Column("id", sa.Integer(), primary_key=True), sa.Column("nomenclature_id", sa.Integer(), nullable=False), sa.Column("characteristic_id", sa.Integer(), nullable=False),
        *_timestamps(), sa.ForeignKeyConstraint(["nomenclature_id"], ["nomenclatures.id"], ondelete="CASCADE"), sa.ForeignKeyConstraint(["characteristic_id"], ["characteristic_definitions.id"], ondelete="RESTRICT"),
        sa.UniqueConstraint("nomenclature_id", "characteristic_id", name="uq_nomenclature_characteristics_pair"))
    op.create_index("ix_nomenclature_characteristics_nomenclature_id", "nomenclature_characteristics", ["nomenclature_id"])
    op.create_index("ix_nomenclature_characteristics_characteristic_id", "nomenclature_characteristics", ["characteristic_id"])
    op.create_table("nomenclature_variants",
        sa.Column("id", sa.Integer(), primary_key=True), sa.Column("nomenclature_id", sa.Integer(), nullable=False), sa.Column("article", sa.String(100), nullable=False), sa.Column("name", sa.String(255), nullable=False), sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        *_timestamps(), sa.ForeignKeyConstraint(["nomenclature_id"], ["nomenclatures.id"], ondelete="CASCADE"), sa.UniqueConstraint("article", name="uq_nomenclature_variants_article"))
    for column in ("nomenclature_id", "article", "is_active"):
        op.create_index(f"ix_nomenclature_variants_{column}", "nomenclature_variants", [column])
    op.create_table("nomenclature_variant_options",
        sa.Column("variant_id", sa.Integer(), nullable=False), sa.Column("option_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["variant_id"], ["nomenclature_variants.id"], ondelete="CASCADE"), sa.ForeignKeyConstraint(["option_id"], ["characteristic_options.id"], ondelete="RESTRICT"), sa.PrimaryKeyConstraint("variant_id", "option_id"))
    op.add_column("sales_order_items", sa.Column("nomenclature_variant_id", sa.Integer(), nullable=True))
    op.create_index("ix_sales_order_items_nomenclature_variant_id", "sales_order_items", ["nomenclature_variant_id"])
    op.create_foreign_key("fk_sales_order_items_nomenclature_variant", "sales_order_items", "nomenclature_variants", ["nomenclature_variant_id"], ["id"], ondelete="SET NULL")
    op.create_table("sales_order_item_variant_snapshots",
        sa.Column("id", sa.Integer(), primary_key=True), sa.Column("order_item_id", sa.Integer(), nullable=False), sa.Column("characteristic_id", sa.Integer(), nullable=False), sa.Column("characteristic_code", sa.String(100), nullable=False), sa.Column("characteristic_name", sa.String(255), nullable=False), sa.Column("option_id", sa.Integer(), nullable=False), sa.Column("option_code", sa.String(100), nullable=False), sa.Column("option_label", sa.String(255), nullable=False),
        sa.ForeignKeyConstraint(["order_item_id"], ["sales_order_items.id"], ondelete="CASCADE"), sa.UniqueConstraint("order_item_id", "characteristic_id", name="uq_sales_order_item_variant_snapshot_characteristic"))
    op.create_index("ix_sales_order_item_variant_snapshots_order_item_id", "sales_order_item_variant_snapshots", ["order_item_id"])


def downgrade() -> None:
    op.drop_index("ix_sales_order_item_variant_snapshots_order_item_id", table_name="sales_order_item_variant_snapshots")
    op.drop_table("sales_order_item_variant_snapshots")
    op.drop_constraint("fk_sales_order_items_nomenclature_variant", "sales_order_items", type_="foreignkey")
    op.drop_index("ix_sales_order_items_nomenclature_variant_id", table_name="sales_order_items")
    op.drop_column("sales_order_items", "nomenclature_variant_id")
    op.drop_table("nomenclature_variant_options")
    for column in ("is_active", "article", "nomenclature_id"):
        op.drop_index(f"ix_nomenclature_variants_{column}", table_name="nomenclature_variants")
    op.drop_table("nomenclature_variants")
    for table, indexes in (("nomenclature_characteristics", ("characteristic_id", "nomenclature_id")), ("category_characteristics", ("characteristic_id", "category_id")), ("characteristic_options", ("is_active", "characteristic_id")), ("characteristic_definitions", ("is_active", "name", "code"))):
        for column in indexes: op.drop_index(f"ix_{table}_{column}", table_name=table)
        op.drop_table(table)
