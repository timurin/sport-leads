"""add units of measure directory and nomenclature storage unit

Revision ID: e5f6a7b8c901
Revises: d4e5f6a7b890
"""

import sqlalchemy as sa
from alembic import context, op

revision = "e5f6a7b8c901"
down_revision = "d4e5f6a7b890"
branch_labels = None
depends_on = None

SYSTEM_UNITS = (
    ("PCS", "Штука", "шт.", "QUANTITY", 0),
    ("SET", "Комплект", "компл.", "QUANTITY", 0),
    ("PAIR", "Пара", "пар.", "QUANTITY", 0),
    ("M", "Метр", "м", "LENGTH", 3),
    ("M2", "Квадратный метр", "м²", "AREA", 3),
    ("G", "Грамм", "г", "MASS", 3),
    ("KG", "Килограмм", "кг", "MASS", 3),
    ("MIN", "Минута", "мин.", "TIME", 2),
    ("HOUR", "Час", "ч", "TIME", 2),
    ("SERVICE", "Услуга", "усл.", "SERVICE", 2),
)


def upgrade() -> None:
    op.create_table(
        "units_of_measure",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("code", sa.String(length=30), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("symbol", sa.String(length=20), nullable=False),
        sa.Column("unit_category", sa.String(length=20), nullable=False),
        sa.Column("precision", sa.Integer(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("is_system", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("unit_category IN ('QUANTITY', 'LENGTH', 'AREA', 'MASS', 'TIME', 'SERVICE')", name="ck_units_of_measure_category"),
        sa.CheckConstraint("precision >= 0 AND precision <= 6", name="ck_units_of_measure_precision"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("code", name="uq_units_of_measure_code"),
    )
    for column in ("code", "name", "unit_category", "is_active"):
        op.create_index(f"ix_units_of_measure_{column}", "units_of_measure", [column])

    op.add_column("nomenclatures", sa.Column("storage_unit_id", sa.Integer(), nullable=True))
    op.create_index("ix_nomenclatures_storage_unit_id", "nomenclatures", ["storage_unit_id"])
    op.create_foreign_key("fk_nomenclatures_storage_unit_id", "nomenclatures", "units_of_measure", ["storage_unit_id"], ["id"], ondelete="RESTRICT")

    if context.is_offline_mode():
        return
    connection = op.get_bind()
    units = sa.table("units_of_measure", *[
        sa.column(name, sa.String()) for name in ("code", "name", "symbol", "unit_category")
    ], sa.column("precision", sa.Integer()), sa.column("is_active", sa.Boolean()), sa.column("is_system", sa.Boolean()))
    op.bulk_insert(units, [
        {"code": code, "name": name, "symbol": symbol, "unit_category": category, "precision": precision, "is_active": True, "is_system": True}
        for code, name, symbol, category, precision in SYSTEM_UNITS
    ])
    aliases = {"шт": "PCS", "шт.": "PCS", "компл": "SET", "компл.": "SET", "пар": "PAIR", "пар.": "PAIR", "м": "M", "м2": "M2", "м²": "M2", "г": "G", "кг": "KG", "мин": "MIN", "мин.": "MIN", "ч": "HOUR", "усл": "SERVICE", "усл.": "SERVICE"}
    values = connection.execute(sa.text("SELECT DISTINCT unit FROM nomenclatures WHERE trim(unit) <> '' ORDER BY unit")).scalars().all()
    for index, raw_value in enumerate(values, start=1):
        value = str(raw_value).strip()
        code = aliases.get(value.lower())
        if code is None:
            code = f"LEGACY-{index}"
            connection.execute(sa.text("INSERT INTO units_of_measure (code, name, symbol, unit_category, precision, is_active, is_system) VALUES (:code, :name, :symbol, 'QUANTITY', 0, true, false)"), {"code": code, "name": value, "symbol": value})
        connection.execute(sa.text("UPDATE nomenclatures SET storage_unit_id = (SELECT id FROM units_of_measure WHERE code = :code) WHERE trim(unit) = :value"), {"code": code, "value": value})


def downgrade() -> None:
    op.drop_constraint("fk_nomenclatures_storage_unit_id", "nomenclatures", type_="foreignkey")
    op.drop_index("ix_nomenclatures_storage_unit_id", table_name="nomenclatures")
    op.drop_column("nomenclatures", "storage_unit_id")
    for column in ("is_active", "unit_category", "name", "code"):
        op.drop_index(f"ix_units_of_measure_{column}", table_name="units_of_measure")
    op.drop_table("units_of_measure")
