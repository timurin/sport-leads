"""PC-04.2F: cutting method on card lines and unambiguous resource links.

Existing cutting_method values stay null. Links are created only when the
tech-operation code exists exactly once. Plotters, calender and procurement
are not linked here.
"""
import sqlalchemy as sa
from alembic import op

revision = "f2a3b4c5d6e7"
down_revision = "a6b7c8d9e012"
branch_labels = None
depends_on = None

# Canonical PC-04.2C units. Inserted only when the resource row is absent.
LINKS = (
    {
        "code": "sewing",
        "resource_key": "sewers",
        "name": "Пошив",
        "resource_type": "labor",
        "capacity_unit": "labor_hour",
        "calculation_mode": "sewing_norm",
        "base_rate": None,
        "staff_count": None,
        "norm_rates": {},
    },
    {
        "code": "packaging",
        "resource_key": "packing_team",
        "name": "Бригада упаковки",
        "resource_type": "labor",
        "capacity_unit": "item",
        "calculation_mode": "team_rate",
        "base_rate": "80",
        "staff_count": 1,
        "norm_rates": {"items_per_team_hour": "80"},
    },
    {
        "code": "manual-cut",
        "resource_key": "cutters",
        "name": "Общий пул раскройщиков",
        "resource_type": "labor",
        "capacity_unit": "item",
        "calculation_mode": "cutting_methods",
        "base_rate": None,
        "staff_count": None,
        "norm_rates": {
            "manual_single_items_per_person_hour": "20",
            "manual_lay_items_per_person_hour": "40",
        },
    },
    {
        "code": "laser",
        "resource_key": "laser",
        "name": "Лазер",
        "resource_type": "machine",
        "capacity_unit": "item",
        "calculation_mode": "rate",
        "base_rate": "100",
        "staff_count": None,
        "norm_rates": {"items_per_machine_hour": "100"},
    },
)


def upgrade() -> None:
    op.add_column(
        "technical_card_operation_lines",
        sa.Column("cutting_method", sa.String(length=32), nullable=True),
    )
    op.create_check_constraint(
        "ck_technical_card_operation_lines_cutting_method",
        "technical_card_operation_lines",
        "cutting_method IS NULL OR cutting_method IN ('manual_single', 'manual_lay')",
    )
    bind = op.get_bind()
    for spec in LINKS:
        rows = bind.execute(
            sa.text(
                "SELECT id, production_stage_id FROM tech_operations WHERE code = :code"
            ),
            {"code": spec["code"]},
        ).mappings().all()
        if len(rows) != 1:
            continue
        operation = rows[0]
        existing = bind.execute(
            sa.text("SELECT 1 FROM capacity_resources WHERE resource_key = :key"),
            {"key": spec["resource_key"]},
        ).first()
        if existing is None:
            bind.execute(
                sa.text(
                    """
                    INSERT INTO capacity_resources (
                        resource_key, name, resource_type, capacity_unit, base_rate,
                        shifts_per_day, efficiency, include_in_calendar_load,
                        calculation_mode, norm_rates, production_stage_id, staff_count,
                        working_days
                    ) VALUES (
                        :resource_key, :name, :resource_type, :capacity_unit, :base_rate,
                        1, 1, true,
                        :calculation_mode, :norm_rates, :production_stage_id, :staff_count,
                        :working_days
                    )
                    """
                ).bindparams(
                    sa.bindparam("norm_rates", type_=sa.JSON()),
                    sa.bindparam("working_days", type_=sa.JSON()),
                ),
                {
                    "resource_key": spec["resource_key"],
                    "name": spec["name"],
                    "resource_type": spec["resource_type"],
                    "capacity_unit": spec["capacity_unit"],
                    "base_rate": spec["base_rate"],
                    "calculation_mode": spec["calculation_mode"],
                    "norm_rates": spec["norm_rates"],
                    "production_stage_id": operation["production_stage_id"],
                    "staff_count": spec["staff_count"],
                    "working_days": [0, 1, 2, 3, 4],
                },
            )
        bind.execute(
            sa.text(
                """
                INSERT INTO tech_operation_capacity_resources (tech_operation_id, resource_key)
                SELECT :operation_id, :resource_key
                WHERE NOT EXISTS (
                    SELECT 1 FROM tech_operation_capacity_resources
                    WHERE tech_operation_id = :operation_id AND resource_key = :resource_key
                )
                """
            ),
            {"operation_id": operation["id"], "resource_key": spec["resource_key"]},
        )


def downgrade() -> None:
    bind = op.get_bind()
    for spec in LINKS:
        bind.execute(
            sa.text(
                """
                DELETE FROM tech_operation_capacity_resources
                WHERE resource_key = :resource_key
                  AND tech_operation_id IN (
                      SELECT id FROM tech_operations WHERE code = :code
                  )
                """
            ),
            {"resource_key": spec["resource_key"], "code": spec["code"]},
        )
        bind.execute(
            sa.text(
                """
                DELETE FROM capacity_resources
                WHERE resource_key = :resource_key
                  AND NOT EXISTS (
                      SELECT 1 FROM tech_operation_capacity_resources
                      WHERE resource_key = :resource_key
                  )
                  AND NOT EXISTS (
                      SELECT 1 FROM production_capacity_exceptions
                      WHERE resource_key = :resource_key
                  )
                """
            ),
            {"resource_key": spec["resource_key"]},
        )
    op.drop_constraint(
        "ck_technical_card_operation_lines_cutting_method",
        "technical_card_operation_lines",
        type_="check",
    )
    op.drop_column("technical_card_operation_lines", "cutting_method")
