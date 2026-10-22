"""Version existing Role groups; retain the existing M:N and every grant."""
from alembic import op
import sqlalchemy as sa

revision = "arch04e_20261021"
down_revision = "arch04a_20261021"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("roles", sa.Column("version", sa.Integer(), nullable=False, server_default="1"))


def downgrade() -> None:
    # Custom roles/memberships remain usable by the previous RBAC implementation.
    op.drop_column("roles", "version")
