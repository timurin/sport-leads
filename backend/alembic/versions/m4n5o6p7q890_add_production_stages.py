"""add production stages (цеха) and bind ops/routings (Stage 8.3 / ADR-017 amend)

Revision ID: m4n5o6p7q890
Revises: l3m4n5o6p789
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "m4n5o6p7q890"
down_revision = "l3m4n5o6p789"
branch_labels = None
depends_on = None

SEED_STAGES = [
    ("Дизайн", "design", 10),
    ("Раскрой", "cutting", 20),
    ("Печать", "print", 30),
    ("Пошив", "sewing", 40),
    ("ВТО", "wto", 50),
    ("ОТК", "qc", 60),
    ("Упаковка", "packaging", 70),
]

# tech_operation.code → production_stage.code
OP_TO_STAGE = {
    "sublimation": "print",
    "heat_transfer": "print",
    "sewing": "sewing",
    "wto": "wto",
    "packaging": "packaging",
}


def upgrade() -> None:
    op.create_table(
        "production_stages",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("code", sa.String(length=64), nullable=False),
        sa.Column(
            "is_active",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
        sa.Column(
            "sort_order",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "sort_order >= 0",
            name="ck_production_stages_sort_order_nonnegative",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name", name="uq_production_stages_name"),
        sa.UniqueConstraint("code", name="uq_production_stages_code"),
    )
    op.create_index("ix_production_stages_name", "production_stages", ["name"])
    op.create_index("ix_production_stages_code", "production_stages", ["code"])
    op.create_index("ix_production_stages_is_active", "production_stages", ["is_active"])

    stages_table = sa.table(
        "production_stages",
        sa.column("name", sa.String),
        sa.column("code", sa.String),
        sa.column("is_active", sa.Boolean),
        sa.column("sort_order", sa.Integer),
    )
    op.bulk_insert(
        stages_table,
        [
            {
                "name": name,
                "code": code,
                "is_active": True,
                "sort_order": sort_order,
            }
            for name, code, sort_order in SEED_STAGES
        ],
    )

    op.add_column(
        "tech_operations",
        sa.Column("production_stage_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_tech_operations_production_stage_id",
        "tech_operations",
        "production_stages",
        ["production_stage_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        "ix_tech_operations_production_stage_id",
        "tech_operations",
        ["production_stage_id"],
    )

    op.add_column(
        "work_centers",
        sa.Column("production_stage_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_work_centers_production_stage_id",
        "work_centers",
        "production_stages",
        ["production_stage_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        "ix_work_centers_production_stage_id",
        "work_centers",
        ["production_stage_id"],
    )

    op.add_column(
        "shop_routing_stage_lines",
        sa.Column("production_stage_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_shop_routing_stage_lines_production_stage_id",
        "shop_routing_stage_lines",
        "production_stages",
        ["production_stage_id"],
        ["id"],
        ondelete="RESTRICT",
    )
    op.create_index(
        "ix_shop_routing_stage_lines_production_stage_id",
        "shop_routing_stage_lines",
        ["production_stage_id"],
    )

    op.add_column(
        "technical_card_stage_results",
        sa.Column("production_stage_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_technical_card_stage_results_production_stage_id",
        "technical_card_stage_results",
        "production_stages",
        ["production_stage_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        "ix_technical_card_stage_results_production_stage_id",
        "technical_card_stage_results",
        ["production_stage_id"],
    )

    op.add_column(
        "technical_card_operation_lines",
        sa.Column("production_stage_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_technical_card_operation_lines_production_stage_id",
        "technical_card_operation_lines",
        "production_stages",
        ["production_stage_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        "ix_technical_card_operation_lines_production_stage_id",
        "technical_card_operation_lines",
        ["production_stage_id"],
    )

    # Bind seed tech ops and backfill routing / TC labels by name/code.
    bind = op.get_bind()
    stage_rows = bind.execute(
        sa.text("SELECT id, name, code FROM production_stages")
    ).fetchall()
    by_code = {row.code: row.id for row in stage_rows}
    by_name_lower = {str(row.name).strip().lower(): row.id for row in stage_rows}

    for op_code, stage_code in OP_TO_STAGE.items():
        stage_id = by_code.get(stage_code)
        if stage_id is None:
            continue
        bind.execute(
            sa.text(
                "UPDATE tech_operations SET production_stage_id = :sid "
                "WHERE code = :code"
            ),
            {"sid": stage_id, "code": op_code},
        )

    line_rows = bind.execute(
        sa.text("SELECT id, stage_label FROM shop_routing_stage_lines")
    ).fetchall()
    for line in line_rows:
        label = str(line.stage_label or "").strip().lower()
        stage_id = by_name_lower.get(label)
        if stage_id is None:
            # Common aliases
            if "отк" in label or "качеств" in label:
                stage_id = by_code.get("qc")
            elif "печат" in label:
                stage_id = by_code.get("print")
            elif "раскр" in label:
                stage_id = by_code.get("cutting")
            elif "пошив" in label:
                stage_id = by_code.get("sewing")
            elif "дизайн" in label or "макет" in label:
                stage_id = by_code.get("design")
            elif "вто" in label:
                stage_id = by_code.get("wto")
            elif "упаков" in label:
                stage_id = by_code.get("packaging")
        if stage_id is not None:
            bind.execute(
                sa.text(
                    "UPDATE shop_routing_stage_lines SET production_stage_id = :sid "
                    "WHERE id = :id"
                ),
                {"sid": stage_id, "id": line.id},
            )

    # TC stage results / op lines: match by label
    for table in (
        "technical_card_stage_results",
        "technical_card_operation_lines",
    ):
        rows = bind.execute(
            sa.text(f"SELECT id, stage_label FROM {table} WHERE stage_label IS NOT NULL")
        ).fetchall()
        for row in rows:
            label = str(row.stage_label or "").strip().lower()
            stage_id = by_name_lower.get(label)
            if stage_id is None:
                continue
            bind.execute(
                sa.text(
                    f"UPDATE {table} SET production_stage_id = :sid WHERE id = :id"
                ),
                {"sid": stage_id, "id": row.id},
            )


def downgrade() -> None:
    op.drop_index(
        "ix_technical_card_operation_lines_production_stage_id",
        table_name="technical_card_operation_lines",
    )
    op.drop_constraint(
        "fk_technical_card_operation_lines_production_stage_id",
        "technical_card_operation_lines",
        type_="foreignkey",
    )
    op.drop_column("technical_card_operation_lines", "production_stage_id")

    op.drop_index(
        "ix_technical_card_stage_results_production_stage_id",
        table_name="technical_card_stage_results",
    )
    op.drop_constraint(
        "fk_technical_card_stage_results_production_stage_id",
        "technical_card_stage_results",
        type_="foreignkey",
    )
    op.drop_column("technical_card_stage_results", "production_stage_id")

    op.drop_index(
        "ix_shop_routing_stage_lines_production_stage_id",
        table_name="shop_routing_stage_lines",
    )
    op.drop_constraint(
        "fk_shop_routing_stage_lines_production_stage_id",
        "shop_routing_stage_lines",
        type_="foreignkey",
    )
    op.drop_column("shop_routing_stage_lines", "production_stage_id")

    op.drop_index("ix_work_centers_production_stage_id", table_name="work_centers")
    op.drop_constraint(
        "fk_work_centers_production_stage_id", "work_centers", type_="foreignkey"
    )
    op.drop_column("work_centers", "production_stage_id")

    op.drop_index("ix_tech_operations_production_stage_id", table_name="tech_operations")
    op.drop_constraint(
        "fk_tech_operations_production_stage_id",
        "tech_operations",
        type_="foreignkey",
    )
    op.drop_column("tech_operations", "production_stage_id")

    op.drop_index("ix_production_stages_is_active", table_name="production_stages")
    op.drop_index("ix_production_stages_code", table_name="production_stages")
    op.drop_index("ix_production_stages_name", table_name="production_stages")
    op.drop_table("production_stages")
