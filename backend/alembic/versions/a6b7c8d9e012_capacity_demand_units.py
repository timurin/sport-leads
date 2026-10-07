"""PC-04.2C: align catalog capacity units with ResourceDemand.

Keys, operation links, rates and dated exceptions stay. Exception capacity
numbers are not converted from hours into meters or items.
"""
import sqlalchemy as sa
from alembic import op

revision = "a6b7c8d9e012"
down_revision = "z5a6b7c8d901"
branch_labels = None
depends_on = None

UNIT_CHECK = "(resource_type = 'milestone' AND capacity_unit IS NULL AND calculation_mode = 'milestone' AND base_rate IS NULL AND staff_count IS NULL AND hours_per_day IS NULL AND work_center_id IS NULL) OR (resource_type = 'labor' AND work_center_id IS NULL AND calculation_mode <> 'milestone' AND (capacity_unit IN ('labor_hour', 'team_hour') OR (capacity_unit = 'item' AND calculation_mode = 'cutting_methods') OR (capacity_unit = 'item' AND calculation_mode = 'team_rate' AND base_rate > 0))) OR (resource_type = 'machine' AND staff_count IS NULL AND calculation_mode <> 'milestone' AND (capacity_unit = 'machine_hour' OR (capacity_unit IN ('linear_meter', 'item') AND calculation_mode = 'rate' AND base_rate > 0))) OR (resource_type = 'throughput' AND capacity_unit IN ('item', 'linear_meter') AND base_rate > 0 AND calculation_mode = 'rate' AND work_center_id IS NULL)"
PREVIOUS_UNIT_CHECK = "(resource_type = 'milestone' AND capacity_unit IS NULL AND calculation_mode = 'milestone' AND base_rate IS NULL AND staff_count IS NULL AND hours_per_day IS NULL AND work_center_id IS NULL) OR (resource_type = 'labor' AND capacity_unit IN ('labor_hour', 'team_hour') AND calculation_mode <> 'milestone' AND work_center_id IS NULL) OR (resource_type = 'machine' AND capacity_unit = 'machine_hour' AND calculation_mode <> 'milestone' AND staff_count IS NULL) OR (resource_type = 'throughput' AND capacity_unit IN ('item', 'linear_meter') AND base_rate > 0 AND calculation_mode = 'rate' AND work_center_id IS NULL)"


def _replace_unit_check(condition: str) -> None:
    op.drop_constraint("ck_capacity_resource_unit", "capacity_resources", type_="check")
    op.create_check_constraint("ck_capacity_resource_unit", "capacity_resources", condition)


def upgrade() -> None:
    _replace_unit_check(UNIT_CHECK)
    op.execute(
        sa.text(
            """
            UPDATE capacity_resources
            SET capacity_unit = 'linear_meter'
            WHERE resource_key IN ('plotter_1', 'plotter_2', 'plotter_3', 'plotter_4', 'calender')
              AND resource_type = 'machine'
              AND capacity_unit = 'machine_hour'
              AND calculation_mode = 'rate'
              AND base_rate > 0
            """
        )
    )
    op.execute(
        sa.text(
            """
            UPDATE capacity_resources
            SET capacity_unit = 'item'
            WHERE resource_key = 'laser'
              AND resource_type = 'machine'
              AND capacity_unit = 'machine_hour'
              AND calculation_mode = 'rate'
              AND base_rate > 0
            """
        )
    )
    op.execute(
        sa.text(
            """
            UPDATE capacity_resources
            SET capacity_unit = 'item'
            WHERE resource_key = 'cutters'
              AND resource_type = 'labor'
              AND capacity_unit = 'labor_hour'
              AND calculation_mode = 'cutting_methods'
            """
        )
    )
    # One brigade. base_rate stays items per team-hour and is not multiplied by a headcount.
    op.execute(
        sa.text(
            """
            UPDATE capacity_resources
            SET capacity_unit = 'item', staff_count = 1
            WHERE resource_key = 'packing_team'
              AND resource_type = 'labor'
              AND capacity_unit = 'team_hour'
              AND calculation_mode = 'team_rate'
              AND base_rate > 0
            """
        )
    )


def downgrade() -> None:
    op.execute(
        sa.text(
            """
            UPDATE capacity_resources
            SET capacity_unit = 'machine_hour'
            WHERE resource_key IN ('plotter_1', 'plotter_2', 'plotter_3', 'plotter_4', 'calender')
              AND resource_type = 'machine'
              AND capacity_unit = 'linear_meter'
              AND calculation_mode = 'rate'
            """
        )
    )
    op.execute(
        sa.text(
            """
            UPDATE capacity_resources
            SET capacity_unit = 'machine_hour'
            WHERE resource_key = 'laser'
              AND resource_type = 'machine'
              AND capacity_unit = 'item'
              AND calculation_mode = 'rate'
            """
        )
    )
    op.execute(
        sa.text(
            """
            UPDATE capacity_resources
            SET capacity_unit = 'labor_hour'
            WHERE resource_key = 'cutters'
              AND resource_type = 'labor'
              AND capacity_unit = 'item'
              AND calculation_mode = 'cutting_methods'
            """
        )
    )
    op.execute(
        sa.text(
            """
            UPDATE capacity_resources
            SET capacity_unit = 'team_hour', staff_count = 2
            WHERE resource_key = 'packing_team'
              AND resource_type = 'labor'
              AND capacity_unit = 'item'
              AND calculation_mode = 'team_rate'
              AND staff_count = 1
            """
        )
    )
    _replace_unit_check(PREVIOUS_UNIT_CHECK)
