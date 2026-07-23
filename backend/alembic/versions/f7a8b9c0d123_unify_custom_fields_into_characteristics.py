"""Unify custom fields into characteristics catalog (ADR-015 / 4.8.2).

Revision ID: f7a8b9c0d123
Revises: e6f7a8b9c012
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy import text

revision = "f7a8b9c0d123"
down_revision = "e6f7a8b9c012"
branch_labels = None
depends_on = None


KIND_MAP = {
    "STRING": "STRING",
    "TEXT": "TEXT",
    "INTEGER": "INTEGER",
    "DECIMAL": "DECIMAL",
    "BOOLEAN": "BOOLEAN",
    "DATE": "DATE",
    "SINGLE_SELECT": "LIST",
    "MULTI_SELECT": "MULTI_SELECT",
    "COLOR": "COLOR",
}


def upgrade() -> None:
    op.add_column(
        "characteristic_definitions",
        sa.Column("description", sa.Text(), nullable=True),
    )
    op.add_column(
        "characteristic_definitions",
        sa.Column("unit_id", sa.Integer(), nullable=True),
    )
    op.add_column(
        "characteristic_definitions",
        sa.Column(
            "is_variant_dimension",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )
    op.add_column(
        "characteristic_definitions",
        sa.Column(
            "is_searchable",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )
    op.add_column(
        "characteristic_definitions",
        sa.Column(
            "is_filterable",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )
    op.add_column(
        "characteristic_definitions",
        sa.Column(
            "is_visible",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
    )
    op.add_column(
        "characteristic_definitions",
        sa.Column(
            "is_system",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )
    op.create_index(
        "ix_characteristic_definitions_unit_id",
        "characteristic_definitions",
        ["unit_id"],
    )
    op.create_index(
        "ix_characteristic_definitions_is_variant_dimension",
        "characteristic_definitions",
        ["is_variant_dimension"],
    )
    op.create_foreign_key(
        "fk_characteristic_definitions_unit_id",
        "characteristic_definitions",
        "units_of_measure",
        ["unit_id"],
        ["id"],
        ondelete="RESTRICT",
    )
    op.execute(
        text(
            "UPDATE characteristic_definitions SET is_variant_dimension = true, is_system = true "
            "WHERE code IN ('color', 'size')"
        )
    )
    op.execute(
        text(
            "UPDATE characteristic_definitions SET is_variant_dimension = true "
            "WHERE kind IN ('LIST', 'COLOR')"
        )
    )
    op.create_index(
        "uq_characteristic_definitions_name_lower",
        "characteristic_definitions",
        [sa.text("lower(name)")],
        unique=True,
    )
    op.create_check_constraint(
        "ck_characteristic_definitions_kind",
        "characteristic_definitions",
        "kind IN ('STRING', 'TEXT', 'INTEGER', 'DECIMAL', 'BOOLEAN', 'DATE', "
        "'LIST', 'MULTI_SELECT', 'COLOR')",
    )

    op.add_column(
        "category_characteristics",
        sa.Column(
            "is_visible",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
    )
    op.add_column(
        "category_characteristics",
        sa.Column("default_string_value", sa.Text(), nullable=True),
    )
    op.add_column(
        "category_characteristics",
        sa.Column("default_integer_value", sa.Integer(), nullable=True),
    )
    op.add_column(
        "category_characteristics",
        sa.Column("default_decimal_value", sa.Numeric(18, 6), nullable=True),
    )
    op.add_column(
        "category_characteristics",
        sa.Column("default_boolean_value", sa.Boolean(), nullable=True),
    )
    op.add_column(
        "category_characteristics",
        sa.Column("default_date_value", sa.Date(), nullable=True),
    )
    op.add_column(
        "category_characteristics",
        sa.Column("default_option_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_category_characteristics_default_option_id",
        "category_characteristics",
        "characteristic_options",
        ["default_option_id"],
        ["id"],
        ondelete="RESTRICT",
    )

    op.create_table(
        "category_characteristic_default_options",
        sa.Column(
            "category_characteristic_id",
            sa.Integer(),
            sa.ForeignKey("category_characteristics.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "option_id",
            sa.Integer(),
            sa.ForeignKey("characteristic_options.id", ondelete="RESTRICT"),
            primary_key=True,
        ),
    )

    op.create_table(
        "nomenclature_characteristic_values",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "nomenclature_id",
            sa.Integer(),
            sa.ForeignKey("nomenclatures.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "characteristic_id",
            sa.Integer(),
            sa.ForeignKey("characteristic_definitions.id", ondelete="RESTRICT"),
            nullable=False,
            index=True,
        ),
        sa.Column("string_value", sa.Text(), nullable=True),
        sa.Column("integer_value", sa.Integer(), nullable=True),
        sa.Column("decimal_value", sa.Numeric(18, 6), nullable=True),
        sa.Column("boolean_value", sa.Boolean(), nullable=True),
        sa.Column("date_value", sa.Date(), nullable=True),
        sa.Column(
            "option_id",
            sa.Integer(),
            sa.ForeignKey("characteristic_options.id", ondelete="RESTRICT"),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.UniqueConstraint(
            "nomenclature_id",
            "characteristic_id",
            name="uq_nomenclature_characteristic_values_pair",
        ),
    )
    op.create_table(
        "nomenclature_characteristic_value_options",
        sa.Column(
            "value_id",
            sa.Integer(),
            sa.ForeignKey("nomenclature_characteristic_values.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "option_id",
            sa.Integer(),
            sa.ForeignKey("characteristic_options.id", ondelete="RESTRICT"),
            primary_key=True,
        ),
    )

    conn = op.get_bind()
    # Temporary mapping tables
    op.create_table(
        "_cf_def_map",
        sa.Column("old_id", sa.Integer(), primary_key=True),
        sa.Column("new_id", sa.Integer(), nullable=False),
    )
    op.create_table(
        "_cf_opt_map",
        sa.Column("old_id", sa.Integer(), primary_key=True),
        sa.Column("new_id", sa.Integer(), nullable=False),
    )

    defs = conn.execute(
        text(
            "SELECT id, code, name, description, data_type, unit_id, is_searchable, "
            "is_filterable, is_visible, is_active, is_system, created_at, updated_at "
            "FROM custom_field_definitions ORDER BY id"
        )
    ).mappings().all()

    existing_codes = {
        row[0]
        for row in conn.execute(text("SELECT code FROM characteristic_definitions")).all()
    }
    existing_names = {
        row[0].casefold()
        for row in conn.execute(text("SELECT name FROM characteristic_definitions")).all()
    }

    for row in defs:
        code = row["code"]
        if code in existing_codes:
            code = f"cf_{code}"[:100]
            suffix = 2
            while code in existing_codes:
                code = f"cf_{row['code'][:90]}_{suffix}"[:100]
                suffix += 1
        name = row["name"]
        if name.casefold() in existing_names:
            name = f"{name} (реквизит)"
            suffix = 2
            while name.casefold() in existing_names:
                name = f"{row['name']} (реквизит {suffix})"
                suffix += 1
        kind = KIND_MAP[row["data_type"]]
        new_id = conn.execute(
            text(
                "INSERT INTO characteristic_definitions "
                "(code, name, kind, description, unit_id, is_variant_dimension, "
                "is_searchable, is_filterable, is_visible, is_active, is_system, "
                "created_at, updated_at) "
                "VALUES (:code, :name, :kind, :description, :unit_id, false, "
                ":is_searchable, :is_filterable, :is_visible, :is_active, :is_system, "
                ":created_at, :updated_at) RETURNING id"
            ),
            {
                "code": code,
                "name": name,
                "kind": kind,
                "description": row["description"],
                "unit_id": row["unit_id"],
                "is_searchable": row["is_searchable"],
                "is_filterable": row["is_filterable"],
                "is_visible": row["is_visible"],
                "is_active": row["is_active"],
                "is_system": row["is_system"],
                "created_at": row["created_at"],
                "updated_at": row["updated_at"],
            },
        ).scalar_one()
        conn.execute(
            text("INSERT INTO _cf_def_map (old_id, new_id) VALUES (:old_id, :new_id)"),
            {"old_id": row["id"], "new_id": new_id},
        )
        existing_codes.add(code)
        existing_names.add(name.casefold())

    options = conn.execute(
        text(
            "SELECT id, field_definition_id, code, label, sort_order, is_active, "
            "created_at, updated_at FROM custom_field_options ORDER BY id"
        )
    ).mappings().all()
    for row in options:
        new_def = conn.execute(
            text("SELECT new_id FROM _cf_def_map WHERE old_id = :old_id"),
            {"old_id": row["field_definition_id"]},
        ).scalar_one()
        new_id = conn.execute(
            text(
                "INSERT INTO characteristic_options "
                "(characteristic_id, code, label, hex_value, sort_order, is_active, "
                "created_at, updated_at) "
                "VALUES (:characteristic_id, :code, :label, NULL, :sort_order, "
                ":is_active, :created_at, :updated_at) RETURNING id"
            ),
            {
                "characteristic_id": new_def,
                "code": row["code"],
                "label": row["label"],
                "sort_order": row["sort_order"],
                "is_active": row["is_active"],
                "created_at": row["created_at"],
                "updated_at": row["updated_at"],
            },
        ).scalar_one()
        conn.execute(
            text("INSERT INTO _cf_opt_map (old_id, new_id) VALUES (:old_id, :new_id)"),
            {"old_id": row["id"], "new_id": new_id},
        )

    cat_fields = conn.execute(
        text(
            "SELECT id, category_id, field_definition_id, is_required, inherit, is_visible, "
            "sort_order, default_string_value, default_integer_value, default_decimal_value, "
            "default_boolean_value, default_date_value, default_option_id, created_at, updated_at "
            "FROM category_fields ORDER BY id"
        )
    ).mappings().all()
    cat_map: dict[int, int] = {}
    for row in cat_fields:
        new_def = conn.execute(
            text("SELECT new_id FROM _cf_def_map WHERE old_id = :old_id"),
            {"old_id": row["field_definition_id"]},
        ).scalar_one()
        default_option_id = None
        if row["default_option_id"] is not None:
            default_option_id = conn.execute(
                text("SELECT new_id FROM _cf_opt_map WHERE old_id = :old_id"),
                {"old_id": row["default_option_id"]},
            ).scalar_one()
        exists = conn.execute(
            text(
                "SELECT id FROM category_characteristics "
                "WHERE category_id = :category_id AND characteristic_id = :characteristic_id"
            ),
            {"category_id": row["category_id"], "characteristic_id": new_def},
        ).scalar()
        if exists:
            cat_map[row["id"]] = exists
            continue
        new_id = conn.execute(
            text(
                "INSERT INTO category_characteristics "
                "(category_id, characteristic_id, is_required, inherit, is_visible, sort_order, "
                "default_string_value, default_integer_value, default_decimal_value, "
                "default_boolean_value, default_date_value, default_option_id, "
                "created_at, updated_at) "
                "VALUES (:category_id, :characteristic_id, :is_required, :inherit, :is_visible, "
                ":sort_order, :default_string_value, :default_integer_value, "
                ":default_decimal_value, :default_boolean_value, :default_date_value, "
                ":default_option_id, :created_at, :updated_at) RETURNING id"
            ),
            {
                "category_id": row["category_id"],
                "characteristic_id": new_def,
                "is_required": row["is_required"],
                "inherit": row["inherit"],
                "is_visible": row["is_visible"],
                "sort_order": row["sort_order"],
                "default_string_value": row["default_string_value"],
                "default_integer_value": row["default_integer_value"],
                "default_decimal_value": row["default_decimal_value"],
                "default_boolean_value": row["default_boolean_value"],
                "default_date_value": row["default_date_value"],
                "default_option_id": default_option_id,
                "created_at": row["created_at"],
                "updated_at": row["updated_at"],
            },
        ).scalar_one()
        cat_map[row["id"]] = new_id

    default_opts = conn.execute(
        text(
            "SELECT category_field_id, option_id FROM category_field_default_options"
        )
    ).mappings().all()
    for row in default_opts:
        new_cat = cat_map.get(row["category_field_id"])
        if new_cat is None:
            continue
        new_opt = conn.execute(
            text("SELECT new_id FROM _cf_opt_map WHERE old_id = :old_id"),
            {"old_id": row["option_id"]},
        ).scalar_one()
        conn.execute(
            text(
                "INSERT INTO category_characteristic_default_options "
                "(category_characteristic_id, option_id) VALUES (:cid, :oid) "
                "ON CONFLICT DO NOTHING"
            ),
            {"cid": new_cat, "oid": new_opt},
        )

    values = conn.execute(
        text(
            "SELECT id, nomenclature_id, field_definition_id, string_value, integer_value, "
            "decimal_value, boolean_value, date_value, option_id, created_at, updated_at "
            "FROM nomenclature_field_values ORDER BY id"
        )
    ).mappings().all()
    value_map: dict[int, int] = {}
    for row in values:
        new_def = conn.execute(
            text("SELECT new_id FROM _cf_def_map WHERE old_id = :old_id"),
            {"old_id": row["field_definition_id"]},
        ).scalar_one()
        option_id = None
        if row["option_id"] is not None:
            option_id = conn.execute(
                text("SELECT new_id FROM _cf_opt_map WHERE old_id = :old_id"),
                {"old_id": row["option_id"]},
            ).scalar_one()
        new_id = conn.execute(
            text(
                "INSERT INTO nomenclature_characteristic_values "
                "(nomenclature_id, characteristic_id, string_value, integer_value, "
                "decimal_value, boolean_value, date_value, option_id, created_at, updated_at) "
                "VALUES (:nomenclature_id, :characteristic_id, :string_value, :integer_value, "
                ":decimal_value, :boolean_value, :date_value, :option_id, :created_at, "
                ":updated_at) RETURNING id"
            ),
            {
                "nomenclature_id": row["nomenclature_id"],
                "characteristic_id": new_def,
                "string_value": row["string_value"],
                "integer_value": row["integer_value"],
                "decimal_value": row["decimal_value"],
                "boolean_value": row["boolean_value"],
                "date_value": row["date_value"],
                "option_id": option_id,
                "created_at": row["created_at"],
                "updated_at": row["updated_at"],
            },
        ).scalar_one()
        value_map[row["id"]] = new_id

    value_opts = conn.execute(
        text(
            "SELECT field_value_id, option_id FROM nomenclature_field_value_options"
        )
    ).mappings().all()
    for row in value_opts:
        new_val = value_map.get(row["field_value_id"])
        if new_val is None:
            continue
        new_opt = conn.execute(
            text("SELECT new_id FROM _cf_opt_map WHERE old_id = :old_id"),
            {"old_id": row["option_id"]},
        ).scalar_one()
        conn.execute(
            text(
                "INSERT INTO nomenclature_characteristic_value_options "
                "(value_id, option_id) VALUES (:vid, :oid) ON CONFLICT DO NOTHING"
            ),
            {"vid": new_val, "oid": new_opt},
        )

    op.drop_table("_cf_opt_map")
    op.drop_table("_cf_def_map")

    op.drop_table("nomenclature_field_value_options")
    op.drop_table("category_field_default_options")
    op.drop_table("nomenclature_field_values")
    op.drop_table("category_fields")
    op.drop_table("custom_field_options")
    op.drop_table("custom_field_definitions")


def downgrade() -> None:
    # Recreate empty custom-field tables for reverse path; data restoration is best-effort.
    op.create_table(
        "custom_field_definitions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("code", sa.String(100), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("data_type", sa.String(20), nullable=False),
        sa.Column("unit_id", sa.Integer(), sa.ForeignKey("units_of_measure.id", ondelete="RESTRICT"), nullable=True),
        sa.Column("is_searchable", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("is_filterable", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("is_visible", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("is_system", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("code", name="uq_custom_field_definitions_code"),
    )
    op.create_table(
        "custom_field_options",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("field_definition_id", sa.Integer(), sa.ForeignKey("custom_field_definitions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("code", sa.String(100), nullable=False),
        sa.Column("label", sa.String(255), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("field_definition_id", "code", name="uq_custom_field_options_field_code"),
    )
    op.create_table(
        "category_fields",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("category_id", sa.Integer(), sa.ForeignKey("nomenclature_categories.id", ondelete="CASCADE"), nullable=False),
        sa.Column("field_definition_id", sa.Integer(), sa.ForeignKey("custom_field_definitions.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("is_required", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("inherit", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("is_visible", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("default_string_value", sa.Text(), nullable=True),
        sa.Column("default_integer_value", sa.Integer(), nullable=True),
        sa.Column("default_decimal_value", sa.Numeric(18, 6), nullable=True),
        sa.Column("default_boolean_value", sa.Boolean(), nullable=True),
        sa.Column("default_date_value", sa.Date(), nullable=True),
        sa.Column("default_option_id", sa.Integer(), sa.ForeignKey("custom_field_options.id", ondelete="RESTRICT"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("category_id", "field_definition_id", name="uq_category_fields_category_definition"),
    )
    op.create_table(
        "category_field_default_options",
        sa.Column("category_field_id", sa.Integer(), sa.ForeignKey("category_fields.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("option_id", sa.Integer(), sa.ForeignKey("custom_field_options.id", ondelete="RESTRICT"), primary_key=True),
    )
    op.create_table(
        "nomenclature_field_values",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("nomenclature_id", sa.Integer(), sa.ForeignKey("nomenclatures.id", ondelete="CASCADE"), nullable=False),
        sa.Column("field_definition_id", sa.Integer(), sa.ForeignKey("custom_field_definitions.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("string_value", sa.Text(), nullable=True),
        sa.Column("integer_value", sa.Integer(), nullable=True),
        sa.Column("decimal_value", sa.Numeric(18, 6), nullable=True),
        sa.Column("boolean_value", sa.Boolean(), nullable=True),
        sa.Column("date_value", sa.Date(), nullable=True),
        sa.Column("option_id", sa.Integer(), sa.ForeignKey("custom_field_options.id", ondelete="RESTRICT"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("nomenclature_id", "field_definition_id", name="uq_nomenclature_field_values_definition"),
    )
    op.create_table(
        "nomenclature_field_value_options",
        sa.Column("field_value_id", sa.Integer(), sa.ForeignKey("nomenclature_field_values.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("option_id", sa.Integer(), sa.ForeignKey("custom_field_options.id", ondelete="RESTRICT"), primary_key=True),
    )

    op.drop_table("nomenclature_characteristic_value_options")
    op.drop_table("nomenclature_characteristic_values")
    op.drop_table("category_characteristic_default_options")
    op.drop_constraint(
        "fk_category_characteristics_default_option_id",
        "category_characteristics",
        type_="foreignkey",
    )
    op.drop_column("category_characteristics", "default_option_id")
    op.drop_column("category_characteristics", "default_date_value")
    op.drop_column("category_characteristics", "default_boolean_value")
    op.drop_column("category_characteristics", "default_decimal_value")
    op.drop_column("category_characteristics", "default_integer_value")
    op.drop_column("category_characteristics", "default_string_value")
    op.drop_column("category_characteristics", "is_visible")
    op.drop_constraint(
        "ck_characteristic_definitions_kind",
        "characteristic_definitions",
        type_="check",
    )
    op.drop_index(
        "uq_characteristic_definitions_name_lower",
        table_name="characteristic_definitions",
    )
    op.drop_constraint(
        "fk_characteristic_definitions_unit_id",
        "characteristic_definitions",
        type_="foreignkey",
    )
    op.drop_index(
        "ix_characteristic_definitions_is_variant_dimension",
        table_name="characteristic_definitions",
    )
    op.drop_index(
        "ix_characteristic_definitions_unit_id",
        table_name="characteristic_definitions",
    )
    op.drop_column("characteristic_definitions", "is_system")
    op.drop_column("characteristic_definitions", "is_visible")
    op.drop_column("characteristic_definitions", "is_filterable")
    op.drop_column("characteristic_definitions", "is_searchable")
    op.drop_column("characteristic_definitions", "is_variant_dimension")
    op.drop_column("characteristic_definitions", "unit_id")
    op.drop_column("characteristic_definitions", "description")
