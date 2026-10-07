"""PC-03.4A lightweight capacity settings/date exceptions, no catalog seeds."""
import sqlalchemy as sa
from alembic import op

revision = "v1w2x3y4z567"
down_revision = "u0v1w2x3y456"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "production_capacity_settings",
        sa.Column("resource_key", sa.String(64), primary_key=True),
        sa.Column("production_stage_id", sa.Integer(), sa.ForeignKey("production_stages.id", ondelete="SET NULL"), nullable=True),
        sa.Column("work_center_id", sa.Integer(), sa.ForeignKey("work_centers.id", ondelete="SET NULL"), nullable=True),
        sa.Column("staff_count", sa.Integer(), nullable=True),
        sa.Column("hours_per_day", sa.Numeric(8, 4), nullable=True),
        sa.Column("working_days", sa.JSON(), nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("work_center_id", name="uq_capacity_settings_work_center"),
        sa.CheckConstraint("staff_count IS NULL OR (staff_count >= 0 AND staff_count <= 10000)", name="ck_capacity_settings_staff"),
        sa.CheckConstraint("hours_per_day IS NULL OR (hours_per_day >= 0 AND hours_per_day <= 24)", name="ck_capacity_settings_hours"),
    )
    op.create_table(
        "production_capacity_exceptions",
        sa.Column("resource_key", sa.String(64), sa.ForeignKey("production_capacity_settings.resource_key", ondelete="CASCADE"), primary_key=True),
        sa.Column("date", sa.Date(), primary_key=True),
        sa.Column("capacity", sa.Numeric(14, 4), nullable=True),
        sa.Column("unavailable", sa.Boolean(), nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("capacity IS NULL OR capacity >= 0", name="ck_capacity_exception_capacity"),
        sa.CheckConstraint("(unavailable AND capacity IS NULL) OR (NOT unavailable AND capacity IS NOT NULL)", name="ck_capacity_exception_mode"),
    )


def downgrade() -> None:
    op.drop_table("production_capacity_exceptions")
    op.drop_table("production_capacity_settings")
