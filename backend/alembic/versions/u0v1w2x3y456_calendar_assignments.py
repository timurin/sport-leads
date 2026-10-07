"""PC-03.1 lightweight dated production queue."""
import sqlalchemy as sa
from alembic import op

revision = "u0v1w2x3y456"
down_revision = "t9u0v1w2x345"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "calendar_assignments",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("technical_card_id", sa.Integer(), sa.ForeignKey("technical_cards.id", ondelete="CASCADE"), nullable=False),
        sa.Column("production_stage_id", sa.Integer(), sa.ForeignKey("production_stages.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("planned_date", sa.Date(), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("technical_card_id", "production_stage_id", name="uq_calendar_assignment_card_stage"),
        sa.CheckConstraint("position >= 0", name="ck_calendar_assignment_position"),
    )
    op.create_index("ix_calendar_assignment_date_stage", "calendar_assignments", ["planned_date", "production_stage_id", "position"])


def downgrade() -> None:
    op.drop_index("ix_calendar_assignment_date_stage", table_name="calendar_assignments")
    op.drop_table("calendar_assignments")

