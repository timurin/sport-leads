"""PC-03.7A: shared capacity resources and operation junction, no duplicate storage."""
import sqlalchemy as sa
from alembic import op

revision = "y4z5a6b7c890"
down_revision = "x3y4z5a6b789"
branch_labels = None
depends_on = None

# Frozen PC-03.4 definitions. Values are initial resource metadata, not a second store.
DEFINITIONS = {
    "designers": ("labor", "labor_hour", "explicit_hours", None, {}),
    "print_operator": ("labor", "labor_hour", "explicit_hours", None, {}),
    **{f"plotter_{i}": ("machine", "machine_hour", "rate", "15", {"running_meters_per_hour": "15"}) for i in range(1, 5)},
    "calender": ("machine", "machine_hour", "rate", "60", {"running_meters_per_hour": "60"}),
    "calender_operator": ("labor", "labor_hour", "explicit_hours", None, {}),
    "cutters": ("labor", "labor_hour", "cutting_methods", None,
                {"manual_single_items_per_person_hour": "20", "manual_lay_items_per_person_hour": "40"}),
    "laser": ("machine", "machine_hour", "rate", "100", {"items_per_machine_hour": "100"}),
    "laser_operator": ("labor", "labor_hour", "explicit_hours", None, {}),
    "sewers": ("labor", "labor_hour", "sewing_norm", None, {}),
    "packing_team": ("labor", "team_hour", "team_rate", "80", {"items_per_team_hour": "80"}),
    "procurement": ("milestone", None, "milestone", None, {}),
}
COLUMNS = ["name", "resource_type", "capacity_unit", "base_rate", "shifts_per_day",
           "efficiency", "include_in_calendar_load", "calculation_mode", "norm_rates"]
CHECKS = {
    "ck_capacity_resource_type": "resource_type IN ('labor', 'machine', 'throughput', 'milestone')",
    "ck_capacity_resource_rate": "base_rate IS NULL OR base_rate > 0",
    "ck_capacity_resource_shifts": "shifts_per_day >= 1 AND shifts_per_day <= 24",
    "ck_capacity_resource_efficiency": "efficiency >= 0 AND efficiency <= 1",
    "ck_capacity_resource_daily_hours": "hours_per_day IS NULL OR hours_per_day * shifts_per_day <= 24",
    "ck_capacity_resource_mode": "calculation_mode IN ('explicit_hours', 'rate', 'sewing_norm', 'cutting_methods', 'team_rate', 'milestone')",
    "ck_capacity_resource_unit": "(resource_type = 'milestone' AND capacity_unit IS NULL AND calculation_mode = 'milestone' AND base_rate IS NULL AND staff_count IS NULL AND hours_per_day IS NULL AND work_center_id IS NULL) OR (resource_type = 'labor' AND capacity_unit IN ('labor_hour', 'team_hour') AND calculation_mode <> 'milestone' AND work_center_id IS NULL) OR (resource_type = 'machine' AND capacity_unit = 'machine_hour' AND calculation_mode <> 'milestone' AND staff_count IS NULL) OR (resource_type = 'throughput' AND capacity_unit IN ('item', 'linear_meter') AND base_rate > 0 AND calculation_mode = 'rate' AND work_center_id IS NULL)",
}


def upgrade() -> None:
    bind = op.get_bind()
    rows = bind.execute(sa.text("SELECT resource_key, production_stage_id FROM production_capacity_settings")).mappings().all()
    unknown = {row["resource_key"] for row in rows} - DEFINITIONS.keys()
    if unknown:
        raise RuntimeError(f"Unrecognized legacy capacity keys; explicit mapping required: {sorted(unknown)}")
    # Rename preserves PKs, timestamps, values and existing exception FKs in PostgreSQL.
    op.rename_table("production_capacity_settings", "capacity_resources")
    for column in [sa.Column("name", sa.String(255)), sa.Column("resource_type", sa.String(20)),
                   sa.Column("capacity_unit", sa.String(20)), sa.Column("base_rate", sa.Numeric(14, 4)),
                   sa.Column("shifts_per_day", sa.Integer()), sa.Column("efficiency", sa.Numeric(8, 4)),
                   sa.Column("include_in_calendar_load", sa.Boolean()), sa.Column("calculation_mode", sa.String(32)),
                   sa.Column("norm_rates", sa.JSON())]:
        op.add_column("capacity_resources", column)
    table = sa.table("capacity_resources", *(sa.column(name) for name in COLUMNS), sa.column("resource_key"))
    for row in rows:
        key = row["resource_key"]
        kind, unit, mode, rate, rates = DEFINITIONS[key]
        bind.execute(table.update().where(table.c.resource_key == key).values(
            resource_type=kind, capacity_unit=unit, calculation_mode=mode, base_rate=rate,
            shifts_per_day=1, efficiency=1, include_in_calendar_load=True,
        ))
        # Typed JSON bind; JSON must not be serialized as an SQL string literal.
        bind.execute(sa.text("UPDATE capacity_resources SET norm_rates=:rates WHERE resource_key=:key")
                     .bindparams(sa.bindparam("rates", type_=sa.JSON())), {"rates": rates, "key": key})
    for name in ["resource_type", "shifts_per_day", "efficiency", "include_in_calendar_load", "calculation_mode"]:
        op.alter_column("capacity_resources", name, nullable=False)
    for name, condition in CHECKS.items():
        op.create_check_constraint(name, "capacity_resources", condition)
    op.create_table("tech_operation_capacity_resources",
                    sa.Column("tech_operation_id", sa.Integer(), sa.ForeignKey("tech_operations.id", ondelete="CASCADE"), primary_key=True),
                    sa.Column("resource_key", sa.String(64), sa.ForeignKey("capacity_resources.resource_key", ondelete="RESTRICT"), primary_key=True))
    for row in rows:
        key, stage_id = row["resource_key"], row["production_stage_id"]
        candidates = []
        if key == "print_operator":
            candidates = bind.execute(sa.text("SELECT id, production_stage_id FROM tech_operations WHERE code IN ('sublimation', 'heat_transfer')")).mappings().all()
            if any(candidate["production_stage_id"] != stage_id for candidate in candidates):
                raise RuntimeError("Shared print operator stage differs from the confirmed print operations")
        elif key == "designers":
            candidates = bind.execute(sa.text("SELECT id FROM tech_operations WHERE production_stage_id=:stage"), {"stage": stage_id}).mappings().all()
            if len(candidates) > 1:
                raise RuntimeError("Design operation mapping is ambiguous; explicit links required")
        for candidate in candidates:
            bind.execute(sa.text("INSERT INTO tech_operation_capacity_resources (tech_operation_id, resource_key) VALUES (:id, :key)"),
                         {"id": candidate["id"], "key": key})


def downgrade() -> None:
    op.drop_table("tech_operation_capacity_resources")
    for name in CHECKS:
        op.drop_constraint(name, "capacity_resources", type_="check")
    for name in reversed(COLUMNS):
        op.drop_column("capacity_resources", name)
    op.rename_table("capacity_resources", "production_capacity_settings")
