"""add typed nomenclature custom fields

Revision ID: f6a7b8c9d012
Revises: e5f6a7b8c901
"""

import sqlalchemy as sa
from alembic import op

revision = "f6a7b8c9d012"
down_revision = "e5f6a7b8c901"
branch_labels = None
depends_on = None

DATA_TYPES = "'STRING', 'TEXT', 'INTEGER', 'DECIMAL', 'BOOLEAN', 'DATE', 'SINGLE_SELECT', 'MULTI_SELECT', 'COLOR'"


def upgrade() -> None:
    op.create_table(
        "custom_field_definitions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("code", sa.String(length=100), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("data_type", sa.String(length=20), nullable=False),
        sa.Column("unit_id", sa.Integer(), nullable=True),
        sa.Column("is_searchable", sa.Boolean(), nullable=False),
        sa.Column("is_filterable", sa.Boolean(), nullable=False),
        sa.Column("is_visible", sa.Boolean(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("is_system", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint(f"data_type IN ({DATA_TYPES})", name="ck_custom_field_definitions_data_type"),
        sa.ForeignKeyConstraint(["unit_id"], ["units_of_measure.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("code", name="uq_custom_field_definitions_code"),
    )
    op.create_index("ix_custom_field_definitions_code", "custom_field_definitions", ["code"])
    op.create_index("ix_custom_field_definitions_name", "custom_field_definitions", ["name"])
    op.create_index("ix_custom_field_definitions_data_type", "custom_field_definitions", ["data_type"])
    op.create_index("ix_custom_field_definitions_unit_id", "custom_field_definitions", ["unit_id"])
    op.create_index("ix_custom_field_definitions_is_active", "custom_field_definitions", ["is_active"])

    op.create_table(
        "custom_field_options",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("field_definition_id", sa.Integer(), nullable=False),
        sa.Column("code", sa.String(length=100), nullable=False),
        sa.Column("label", sa.String(length=255), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["field_definition_id"], ["custom_field_definitions.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("field_definition_id", "code", name="uq_custom_field_options_field_code"),
    )
    op.create_index("ix_custom_field_options_field_definition_id", "custom_field_options", ["field_definition_id"])
    op.create_index("ix_custom_field_options_is_active", "custom_field_options", ["is_active"])

    op.create_table(
        "category_fields",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("category_id", sa.Integer(), nullable=False),
        sa.Column("field_definition_id", sa.Integer(), nullable=False),
        sa.Column("is_required", sa.Boolean(), nullable=False),
        sa.Column("inherit", sa.Boolean(), nullable=False),
        sa.Column("is_visible", sa.Boolean(), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.Column("default_string_value", sa.Text(), nullable=True),
        sa.Column("default_integer_value", sa.Integer(), nullable=True),
        sa.Column("default_decimal_value", sa.Numeric(18, 6), nullable=True),
        sa.Column("default_boolean_value", sa.Boolean(), nullable=True),
        sa.Column("default_date_value", sa.Date(), nullable=True),
        sa.Column("default_option_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["category_id"], ["nomenclature_categories.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["field_definition_id"], ["custom_field_definitions.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["default_option_id"], ["custom_field_options.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("category_id", "field_definition_id", name="uq_category_fields_category_definition"),
    )
    op.create_index("ix_category_fields_category_id", "category_fields", ["category_id"])
    op.create_index("ix_category_fields_field_definition_id", "category_fields", ["field_definition_id"])
    op.create_table(
        "category_field_default_options",
        sa.Column("category_field_id", sa.Integer(), nullable=False),
        sa.Column("option_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["category_field_id"], ["category_fields.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["option_id"], ["custom_field_options.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("category_field_id", "option_id"),
    )

    op.create_table(
        "nomenclature_field_values",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("nomenclature_id", sa.Integer(), nullable=False),
        sa.Column("field_definition_id", sa.Integer(), nullable=False),
        sa.Column("string_value", sa.Text(), nullable=True),
        sa.Column("integer_value", sa.Integer(), nullable=True),
        sa.Column("decimal_value", sa.Numeric(18, 6), nullable=True),
        sa.Column("boolean_value", sa.Boolean(), nullable=True),
        sa.Column("date_value", sa.Date(), nullable=True),
        sa.Column("option_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["nomenclature_id"], ["nomenclatures.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["field_definition_id"], ["custom_field_definitions.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["option_id"], ["custom_field_options.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("nomenclature_id", "field_definition_id", name="uq_nomenclature_field_values_definition"),
    )
    op.create_index("ix_nomenclature_field_values_nomenclature_id", "nomenclature_field_values", ["nomenclature_id"])
    op.create_index("ix_nomenclature_field_values_field_definition_id", "nomenclature_field_values", ["field_definition_id"])
    op.create_table(
        "nomenclature_field_value_options",
        sa.Column("field_value_id", sa.Integer(), nullable=False),
        sa.Column("option_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["field_value_id"], ["nomenclature_field_values.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["option_id"], ["custom_field_options.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("field_value_id", "option_id"),
    )


def downgrade() -> None:
    op.drop_table("nomenclature_field_value_options")
    op.drop_index("ix_nomenclature_field_values_field_definition_id", table_name="nomenclature_field_values")
    op.drop_index("ix_nomenclature_field_values_nomenclature_id", table_name="nomenclature_field_values")
    op.drop_table("nomenclature_field_values")
    op.drop_table("category_field_default_options")
    op.drop_index("ix_category_fields_field_definition_id", table_name="category_fields")
    op.drop_index("ix_category_fields_category_id", table_name="category_fields")
    op.drop_table("category_fields")
    op.drop_index("ix_custom_field_options_is_active", table_name="custom_field_options")
    op.drop_index("ix_custom_field_options_field_definition_id", table_name="custom_field_options")
    op.drop_table("custom_field_options")
    op.drop_index("ix_custom_field_definitions_is_active", table_name="custom_field_definitions")
    op.drop_index("ix_custom_field_definitions_data_type", table_name="custom_field_definitions")
    op.execute("DROP INDEX IF EXISTS ix_custom_field_definitions_unit_id")
    op.drop_index("ix_custom_field_definitions_name", table_name="custom_field_definitions")
    op.drop_index("ix_custom_field_definitions_code", table_name="custom_field_definitions")
    op.drop_table("custom_field_definitions")
