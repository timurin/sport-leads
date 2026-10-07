"""PC-04.1 planning fields, route-step identity, and empty allocations."""
import sqlalchemy as sa
from alembic import op

revision = "z5a6b7c8d901"
down_revision = "y4z5a6b7c890"
branch_labels = None
depends_on = None

PLANNING_CHECK = (
    "planning_mode IN ('auto', 'manual_adjusted', 'locked') "
    "AND manual_lock = (planning_mode <> 'auto')"
)
ALLOCATION_UNITS = (
    "capacity_unit IN ('labor_hour', 'machine_hour', 'team_hour', 'item', 'linear_meter')"
)


def upgrade() -> None:
    op.add_column("technical_cards", sa.Column("planning_start_date", sa.Date(), nullable=True))
    op.add_column("technical_cards", sa.Column("shipping_date", sa.Date(), nullable=True))
    op.add_column("technical_cards", sa.Column("priority", sa.Integer(), nullable=True))
    op.add_column(
        "technical_cards",
        sa.Column("plan_locked", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.create_check_constraint(
        "ck_technical_cards_priority",
        "technical_cards",
        "priority IS NULL OR priority >= 1",
    )
    # Creation date in the platform timezone. Do not copy the group wish date.
    op.execute(
        sa.text(
            """
            UPDATE technical_cards
            SET planning_start_date = (
                created_at AT TIME ZONE COALESCE(
                    NULLIF((SELECT default_timezone FROM platform_system_settings WHERE id = 1), ''),
                    'Europe/Moscow'
                )
            )::date
            WHERE planning_start_date IS NULL
            """
        )
    )

    op.add_column("calendar_assignments", sa.Column("routing_stage_line_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_calendar_assignment_route_step",
        "calendar_assignments",
        "shop_routing_stage_lines",
        ["routing_stage_line_id"],
        ["id"],
        ondelete="RESTRICT",
    )
    op.add_column(
        "calendar_assignments",
        sa.Column("planning_mode", sa.String(length=20), nullable=False, server_default="manual_adjusted"),
    )
    op.add_column(
        "calendar_assignments",
        sa.Column("manual_lock", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    # Rows already in the calendar were placed by a person. A future scheduler must not treat them as auto.
    op.execute(
        sa.text(
            "UPDATE calendar_assignments SET planning_mode = 'manual_adjusted', manual_lock = true"
        )
    )
    op.create_check_constraint(
        "ck_calendar_assignment_planning",
        "calendar_assignments",
        PLANNING_CHECK,
    )
    op.alter_column("calendar_assignments", "planning_mode", server_default="auto")
    op.alter_column("calendar_assignments", "manual_lock", server_default=sa.false())

    bind = op.get_bind()
    ambiguous = bind.execute(
        sa.text(
            """
            SELECT a.id
            FROM calendar_assignments AS a
            JOIN technical_cards AS c ON c.id = a.technical_card_id
            JOIN shop_routing_stage_lines AS l
              ON l.routing_template_id = c.routing_template_id
             AND l.production_stage_id = a.production_stage_id
            GROUP BY a.id
            HAVING count(*) > 1
            """
        )
    ).scalars().all()
    if ambiguous:
        raise RuntimeError(
            "Cannot map calendar assignments to one route step: "
            + ", ".join(str(item) for item in ambiguous)
        )
    op.execute(
        sa.text(
            """
            UPDATE calendar_assignments AS a
            SET routing_stage_line_id = matched.line_id
            FROM (
                SELECT a2.id AS assignment_id, min(l.id) AS line_id
                FROM calendar_assignments AS a2
                JOIN technical_cards AS c ON c.id = a2.technical_card_id
                JOIN shop_routing_stage_lines AS l
                  ON l.routing_template_id = c.routing_template_id
                 AND l.production_stage_id = a2.production_stage_id
                GROUP BY a2.id
                HAVING count(*) = 1
            ) AS matched
            WHERE a.id = matched.assignment_id
            """
        )
    )
    op.drop_constraint("uq_calendar_assignment_card_stage", "calendar_assignments", type_="unique")
    op.create_index(
        "uq_calendar_assignment_card_line",
        "calendar_assignments",
        ["technical_card_id", "routing_stage_line_id"],
        unique=True,
        postgresql_where=sa.text("routing_stage_line_id IS NOT NULL"),
    )
    op.create_index(
        "uq_calendar_assignment_card_stage_unmapped",
        "calendar_assignments",
        ["technical_card_id", "production_stage_id"],
        unique=True,
        postgresql_where=sa.text("routing_stage_line_id IS NULL"),
    )

    op.create_table(
        "calendar_allocations",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("assignment_id", sa.Integer(), nullable=False),
        sa.Column("resource_key", sa.String(length=64), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("allocated_amount", sa.Numeric(14, 4), nullable=False),
        sa.Column("capacity_unit", sa.String(length=20), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("allocated_amount > 0", name="ck_calendar_allocation_amount"),
        sa.CheckConstraint(ALLOCATION_UNITS, name="ck_calendar_allocation_unit"),
        sa.ForeignKeyConstraint(
            ["assignment_id"],
            ["calendar_assignments.id"],
            name="fk_calendar_allocation_assignment",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["resource_key"],
            ["capacity_resources.resource_key"],
            name="fk_calendar_allocation_resource",
            ondelete="RESTRICT",
        ),
        sa.UniqueConstraint(
            "assignment_id",
            "resource_key",
            "date",
            name="uq_calendar_allocation_assignment_resource_date",
        ),
    )
    op.create_index("ix_calendar_allocations_assignment_id", "calendar_allocations", ["assignment_id"])


def downgrade() -> None:
    bind = op.get_bind()
    shared = bind.execute(
        sa.text(
            """
            SELECT technical_card_id, production_stage_id
            FROM calendar_assignments
            GROUP BY technical_card_id, production_stage_id
            HAVING count(*) > 1
            """
        )
    ).all()
    if shared:
        raise RuntimeError(
            "Cannot restore one assignment per card and stage while route steps share a stage: "
            + ", ".join(f"card {row[0]} stage {row[1]}" for row in shared)
        )
    op.drop_index("ix_calendar_allocations_assignment_id", table_name="calendar_allocations")
    op.drop_table("calendar_allocations")
    op.drop_index("uq_calendar_assignment_card_line", table_name="calendar_assignments")
    op.drop_index("uq_calendar_assignment_card_stage_unmapped", table_name="calendar_assignments")
    op.drop_constraint("ck_calendar_assignment_planning", "calendar_assignments", type_="check")
    op.drop_constraint("fk_calendar_assignment_route_step", "calendar_assignments", type_="foreignkey")
    op.drop_column("calendar_assignments", "manual_lock")
    op.drop_column("calendar_assignments", "planning_mode")
    op.drop_column("calendar_assignments", "routing_stage_line_id")
    op.create_unique_constraint(
        "uq_calendar_assignment_card_stage",
        "calendar_assignments",
        ["technical_card_id", "production_stage_id"],
    )
    op.drop_constraint("ck_technical_cards_priority", "technical_cards", type_="check")
    op.drop_column("technical_cards", "plan_locked")
    op.drop_column("technical_cards", "priority")
    op.drop_column("technical_cards", "shipping_date")
    op.drop_column("technical_cards", "planning_start_date")
