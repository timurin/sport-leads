"""add nomenclature types and category hierarchy

Revision ID: d4e5f6a7b890
Revises: c3d4e5f6a789
"""

import sqlalchemy as sa
from alembic import context, op

revision = "d4e5f6a7b890"
down_revision = "c3d4e5f6a789"
branch_labels = None
depends_on = None

TYPE_VALUES = "'SERVICE', 'PRODUCT', 'GOODS', 'MATERIAL'"


def upgrade() -> None:
    op.create_table(
        "nomenclature_categories",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("parent_id", sa.Integer(), nullable=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("code", sa.String(length=100), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("nomenclature_type", sa.String(length=20), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("nomenclature_type IN (" + TYPE_VALUES + ")", name="ck_nomenclature_categories_type"),
        sa.CheckConstraint("sort_order >= 0", name="ck_nomenclature_categories_sort_order_nonnegative"),
        sa.ForeignKeyConstraint(["parent_id"], ["nomenclature_categories.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("code", name="uq_nomenclature_categories_code"),
    )
    op.create_index("ix_nomenclature_categories_parent_id", "nomenclature_categories", ["parent_id"])
    op.create_index("ix_nomenclature_categories_name", "nomenclature_categories", ["name"])
    op.create_index("ix_nomenclature_categories_code", "nomenclature_categories", ["code"])
    op.create_index("ix_nomenclature_categories_nomenclature_type", "nomenclature_categories", ["nomenclature_type"])
    op.create_index("ix_nomenclature_categories_is_active", "nomenclature_categories", ["is_active"])

    op.add_column("nomenclatures", sa.Column("category_id", sa.Integer(), nullable=True))
    op.add_column("nomenclatures", sa.Column("nomenclature_type", sa.String(length=20), server_default="PRODUCT", nullable=False))
    op.create_check_constraint("ck_nomenclatures_type", "nomenclatures", "nomenclature_type IN (" + TYPE_VALUES + ")")
    op.create_index("ix_nomenclatures_category_id", "nomenclatures", ["category_id"])
    op.create_index("ix_nomenclatures_nomenclature_type", "nomenclatures", ["nomenclature_type"])
    op.create_foreign_key("fk_nomenclatures_category_id", "nomenclatures", "nomenclature_categories", ["category_id"], ["id"], ondelete="SET NULL")

    if context.is_offline_mode():
        return

    connection = op.get_bind()
    categories = connection.execute(sa.text("SELECT DISTINCT category FROM nomenclatures ORDER BY category")).all()
    for index, (name,) in enumerate(categories, start=1):
        code = f"legacy-category-{index}"
        connection.execute(
            sa.text(
                "INSERT INTO nomenclature_categories "
                "(name, code, nomenclature_type, is_active, sort_order) "
                "VALUES (:name, :code, 'PRODUCT', true, :sort_order)"
            ),
            {"name": name, "code": code, "sort_order": index},
        )
        connection.execute(
            sa.text(
                "UPDATE nomenclatures SET category_id = "
                "(SELECT id FROM nomenclature_categories WHERE code = :code) "
                "WHERE category = :name"
            ),
            {"name": name, "code": code},
        )


def downgrade() -> None:
    op.drop_constraint("fk_nomenclatures_category_id", "nomenclatures", type_="foreignkey")
    op.drop_index("ix_nomenclatures_nomenclature_type", table_name="nomenclatures")
    op.drop_index("ix_nomenclatures_category_id", table_name="nomenclatures")
    op.drop_constraint("ck_nomenclatures_type", "nomenclatures", type_="check")
    op.drop_column("nomenclatures", "nomenclature_type")
    op.drop_column("nomenclatures", "category_id")
    op.drop_index("ix_nomenclature_categories_is_active", table_name="nomenclature_categories")
    op.drop_index("ix_nomenclature_categories_nomenclature_type", table_name="nomenclature_categories")
    op.drop_index("ix_nomenclature_categories_code", table_name="nomenclature_categories")
    op.drop_index("ix_nomenclature_categories_name", table_name="nomenclature_categories")
    op.drop_index("ix_nomenclature_categories_parent_id", table_name="nomenclature_categories")
    op.drop_table("nomenclature_categories")
