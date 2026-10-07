"""PC-03.6A: inclusive operation date range, preserving the legacy start column."""
import sqlalchemy as sa
from alembic import op

revision = "x3y4z5a6b789"
down_revision = "w2x3y4z5a678"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("calendar_assignments", sa.Column("planned_end_date", sa.Date(), nullable=True))
    op.execute("UPDATE calendar_assignments SET planned_end_date = planned_date")
    op.alter_column("calendar_assignments", "planned_end_date", nullable=False)
    op.create_check_constraint("ck_calendar_assignment_date_range", "calendar_assignments",
                               "planned_end_date >= planned_date")


def downgrade() -> None:
    op.drop_constraint("ck_calendar_assignment_date_range", "calendar_assignments", type_="check")
    op.drop_column("calendar_assignments", "planned_end_date")
