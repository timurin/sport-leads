"""Optional one-to-one Employee link, without backfill (ADR-036 / ARCH-04A)."""

from alembic import op
import sqlalchemy as sa

revision = "arch04a_20261021"
down_revision = "j6k7l8m9n013"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("platform_users", sa.Column("employee_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_platform_users_employee_id", "platform_users", "employees",
        ["employee_id"], ["id"], ondelete="RESTRICT",
    )
    # PostgreSQL creates the supporting unique btree index with this constraint.
    op.create_unique_constraint("uq_platform_users_employee_id", "platform_users", ["employee_id"])


def downgrade() -> None:
    op.drop_constraint("uq_platform_users_employee_id", "platform_users", type_="unique")
    op.drop_constraint("fk_platform_users_employee_id", "platform_users", type_="foreignkey")
    op.drop_column("platform_users", "employee_id")
