"""Persist immutable technical-card route snapshots.

Revision ID: a7b8c9d0e123
Revises: k7l8m9n0o124
"""
import sqlalchemy as sa
from alembic import op

revision = "a7b8c9d0e123"
down_revision = "k7l8m9n0o124"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "shop_routing_templates",
        sa.Column("dependency_mode", sa.String(length=20), nullable=False, server_default="sequential"),
    )
    op.create_check_constraint(
        "ck_shop_routing_templates_dependency_mode",
        "shop_routing_templates",
        "dependency_mode IN ('sequential', 'explicit')",
    )
    op.add_column(
        "shop_routing_stage_lines",
        sa.Column("is_required", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    op.create_unique_constraint(
        "uq_shop_routing_stage_lines_id_template",
        "shop_routing_stage_lines",
        ["id", "routing_template_id"],
    )
    op.create_table(
        "shop_routing_node_dependencies",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("routing_template_id", sa.Integer(), sa.ForeignKey("shop_routing_templates.id", ondelete="CASCADE"), nullable=False),
        sa.Column("predecessor_line_id", sa.Integer(), nullable=False),
        sa.Column("successor_line_id", sa.Integer(), nullable=False),
        sa.CheckConstraint("predecessor_line_id <> successor_line_id", name="ck_shop_routing_node_dependencies_distinct"),
        sa.ForeignKeyConstraint(
            ["routing_template_id", "predecessor_line_id"],
            ["shop_routing_stage_lines.routing_template_id", "shop_routing_stage_lines.id"],
            ondelete="CASCADE",
            name="fk_shop_routing_dependency_predecessor",
        ),
        sa.ForeignKeyConstraint(
            ["routing_template_id", "successor_line_id"],
            ["shop_routing_stage_lines.routing_template_id", "shop_routing_stage_lines.id"],
            ondelete="CASCADE",
            name="fk_shop_routing_dependency_successor",
        ),
        sa.UniqueConstraint("predecessor_line_id", "successor_line_id", name="uq_shop_routing_node_dependencies_pair"),
    )
    op.create_index("ix_shop_routing_node_dependencies_template", "shop_routing_node_dependencies", ["routing_template_id"])
    op.add_column("technical_card_stage_results", sa.Column("tech_operation_id", sa.Integer(), nullable=True))
    op.add_column("technical_card_stage_results", sa.Column("source_routing_stage_line_id", sa.Integer(), nullable=True))
    op.add_column(
        "technical_card_stage_results",
        sa.Column("is_required", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    op.add_column("technical_card_stage_results", sa.Column("operation_name", sa.String(length=255), nullable=True))
    op.add_column("technical_card_stage_results", sa.Column("operation_code", sa.String(length=64), nullable=True))
    op.create_index("ix_technical_card_stage_results_tech_operation_id", "technical_card_stage_results", ["tech_operation_id"])
    op.create_index("ix_technical_card_stage_results_source_line", "technical_card_stage_results", ["source_routing_stage_line_id"])
    op.create_unique_constraint(
        "uq_technical_card_stage_results_id_card",
        "technical_card_stage_results",
        ["id", "technical_card_id"],
    )
    op.create_table(
        "technical_card_route_edges",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("technical_card_id", sa.Integer(), sa.ForeignKey("technical_cards.id", ondelete="CASCADE"), nullable=False),
        sa.Column("predecessor_stage_result_id", sa.Integer(), nullable=False),
        sa.Column("successor_stage_result_id", sa.Integer(), nullable=False),
        sa.CheckConstraint(
            "predecessor_stage_result_id <> successor_stage_result_id",
            name="ck_technical_card_route_edges_distinct",
        ),
        sa.ForeignKeyConstraint(
            ["technical_card_id", "predecessor_stage_result_id"],
            ["technical_card_stage_results.technical_card_id", "technical_card_stage_results.id"],
            ondelete="CASCADE",
            name="fk_technical_card_route_edge_predecessor",
        ),
        sa.ForeignKeyConstraint(
            ["technical_card_id", "successor_stage_result_id"],
            ["technical_card_stage_results.technical_card_id", "technical_card_stage_results.id"],
            ondelete="CASCADE",
            name="fk_technical_card_route_edge_successor",
        ),
        sa.UniqueConstraint(
            "predecessor_stage_result_id",
            "successor_stage_result_id",
            name="uq_technical_card_route_edges_pair",
        ),
    )
    op.create_index("ix_technical_card_route_edges_card", "technical_card_route_edges", ["technical_card_id"])
    op.add_column("calendar_assignments", sa.Column("stage_result_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_calendar_assignment_snapshot_operation",
        "calendar_assignments",
        "technical_card_stage_results",
        ["stage_result_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        "uq_calendar_assignment_card_snapshot",
        "calendar_assignments",
        ["technical_card_id", "stage_result_id"],
        unique=True,
        postgresql_where=sa.text("stage_result_id IS NOT NULL"),
    )
    op.drop_constraint("fk_calendar_assignment_route_step", "calendar_assignments", type_="foreignkey")
    op.create_foreign_key(
        "fk_calendar_assignment_route_step",
        "calendar_assignments",
        "shop_routing_stage_lines",
        ["routing_stage_line_id"],
        ["id"],
        ondelete="SET NULL",
    )
    _backfill()


def _backfill() -> None:
    op.execute(
        """
        UPDATE technical_card_stage_results AS stage
        SET tech_operation_id = matched.tech_operation_id,
            operation_name = matched.operation_name
        FROM (
            SELECT technical_card_id, stage_order, production_stage_id,
                   MIN(tech_operation_id) AS tech_operation_id,
                   MIN(operation_name) AS operation_name,
                   COUNT(*) AS copies
            FROM technical_card_operation_lines
            WHERE source_kind = 'routing' AND tech_operation_id IS NOT NULL
            GROUP BY technical_card_id, stage_order, production_stage_id
        ) AS matched
        WHERE stage.tech_operation_id IS NULL
          AND stage.technical_card_id = matched.technical_card_id
          AND stage.stage_order = matched.stage_order
          AND stage.production_stage_id IS NOT DISTINCT FROM matched.production_stage_id
          AND matched.copies = 1
        """
    )
    op.execute(
        """
        UPDATE technical_card_stage_results AS stage
        SET operation_code = operation.code
        FROM tech_operations AS operation
        WHERE stage.tech_operation_id = operation.id
          AND stage.operation_code IS NULL
        """
    )
    op.execute(
        """
        UPDATE technical_card_stage_results AS stage
        SET source_routing_stage_line_id = matched.line_id
        FROM (
            SELECT stage.id AS stage_id, MIN(line.id) AS line_id, COUNT(*) AS copies
            FROM technical_card_stage_results AS stage
            JOIN technical_cards AS card ON card.id = stage.technical_card_id
            JOIN shop_routing_stage_lines AS line
              ON line.routing_template_id = card.routing_template_id
             AND line.stage_order = stage.stage_order
             AND line.production_stage_id IS NOT DISTINCT FROM stage.production_stage_id
            GROUP BY stage.id
        ) AS matched
        WHERE stage.id = matched.stage_id
          AND stage.source_routing_stage_line_id IS NULL
          AND matched.copies = 1
        """
    )
    op.execute(
        """
        INSERT INTO technical_card_stage_results (
            technical_card_id, stage_order, production_stage_id, stage_label, status,
            work_center_id, tech_operation_id, source_routing_stage_line_id, is_required,
            operation_name, operation_code, created_at, updated_at
        )
        SELECT card.id, line.stage_order, line.production_stage_id, line.stage_label, 'pending',
               line.work_center_id, line.tech_operation_id, line.id, line.is_required,
               operation.name, operation.code, now(), now()
        FROM technical_cards AS card
        JOIN shop_routing_stage_lines AS line ON line.routing_template_id = card.routing_template_id
        JOIN tech_operations AS operation ON operation.id = line.tech_operation_id
        WHERE line.production_stage_id IS NOT NULL
          AND NOT EXISTS (
              SELECT 1 FROM technical_card_stage_results AS existing
              WHERE existing.technical_card_id = card.id
          )
          AND NOT EXISTS (
              SELECT 1 FROM shop_routing_stage_lines AS gap
              WHERE gap.routing_template_id = card.routing_template_id
                AND (gap.production_stage_id IS NULL OR gap.tech_operation_id IS NULL)
          )
        """
    )
    op.execute(
        """
        INSERT INTO technical_card_route_edges (
            technical_card_id, predecessor_stage_result_id, successor_stage_result_id
        )
        SELECT earlier.technical_card_id, earlier.id, later.id
        FROM technical_card_stage_results AS earlier
        JOIN technical_card_stage_results AS later
          ON later.technical_card_id = earlier.technical_card_id
         AND later.tech_operation_id IS NOT NULL
         AND earlier.tech_operation_id IS NOT NULL
         AND later.stage_order = (
             SELECT MIN(candidate.stage_order)
             FROM technical_card_stage_results AS candidate
             WHERE candidate.technical_card_id = earlier.technical_card_id
               AND candidate.tech_operation_id IS NOT NULL
               AND candidate.stage_order > earlier.stage_order
         )
        WHERE NOT EXISTS (
            SELECT 1 FROM technical_card_route_edges AS edge
            WHERE edge.technical_card_id = earlier.technical_card_id
        )
        """
    )
    op.execute(
        """
        UPDATE calendar_assignments AS assignment
        SET stage_result_id = matched.stage_id
        FROM (
            SELECT assignment.id AS assignment_id, MIN(stage.id) AS stage_id, COUNT(*) AS copies
            FROM calendar_assignments AS assignment
            JOIN technical_card_stage_results AS stage
              ON stage.technical_card_id = assignment.technical_card_id
             AND stage.source_routing_stage_line_id = assignment.routing_stage_line_id
            WHERE assignment.routing_stage_line_id IS NOT NULL
            GROUP BY assignment.id
        ) AS matched
        WHERE assignment.id = matched.assignment_id
          AND assignment.stage_result_id IS NULL
          AND matched.copies = 1
        """
    )


def downgrade() -> None:
    op.execute("DELETE FROM technical_card_route_edges")
    op.drop_constraint("fk_calendar_assignment_route_step", "calendar_assignments", type_="foreignkey")
    op.create_foreign_key(
        "fk_calendar_assignment_route_step",
        "calendar_assignments",
        "shop_routing_stage_lines",
        ["routing_stage_line_id"],
        ["id"],
        ondelete="RESTRICT",
    )
    op.drop_index("uq_calendar_assignment_card_snapshot", table_name="calendar_assignments")
    op.drop_constraint("fk_calendar_assignment_snapshot_operation", "calendar_assignments", type_="foreignkey")
    op.drop_column("calendar_assignments", "stage_result_id")
    op.drop_index("ix_technical_card_route_edges_card", table_name="technical_card_route_edges")
    op.drop_table("technical_card_route_edges")
    op.drop_constraint("uq_technical_card_stage_results_id_card", "technical_card_stage_results", type_="unique")
    op.drop_index("ix_technical_card_stage_results_source_line", table_name="technical_card_stage_results")
    op.drop_index("ix_technical_card_stage_results_tech_operation_id", table_name="technical_card_stage_results")
    op.drop_column("technical_card_stage_results", "operation_code")
    op.drop_column("technical_card_stage_results", "operation_name")
    op.drop_column("technical_card_stage_results", "is_required")
    op.drop_column("technical_card_stage_results", "source_routing_stage_line_id")
    op.drop_column("technical_card_stage_results", "tech_operation_id")
    op.drop_index("ix_shop_routing_node_dependencies_template", table_name="shop_routing_node_dependencies")
    op.drop_table("shop_routing_node_dependencies")
    op.drop_constraint("uq_shop_routing_stage_lines_id_template", "shop_routing_stage_lines", type_="unique")
    op.drop_column("shop_routing_stage_lines", "is_required")
    op.drop_constraint("ck_shop_routing_templates_dependency_mode", "shop_routing_templates", type_="check")
    op.drop_column("shop_routing_templates", "dependency_mode")
