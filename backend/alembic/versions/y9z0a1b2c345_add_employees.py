"""Add employees org HR directory (2.4.2).

Revision ID: y9z0a1b2c345
Revises: x8y9z0a1b234
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "y9z0a1b2c345"
down_revision = "x8y9z0a1b234"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "employees",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("full_name", sa.String(length=255), nullable=False),
        sa.Column(
            "organization_id",
            sa.Integer(),
            sa.ForeignKey("organizations.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("position", sa.String(length=150), nullable=True),
        sa.Column("department", sa.String(length=150), nullable=True),
        sa.Column("phone", sa.String(length=50), nullable=True),
        sa.Column("email", sa.String(length=255), nullable=True),
        sa.Column("employment_date", sa.Date(), nullable=True),
        sa.Column(
            "is_active",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index("ix_employees_full_name", "employees", ["full_name"])
    op.create_index("ix_employees_organization_id", "employees", ["organization_id"])
    op.create_index("ix_employees_phone", "employees", ["phone"])
    op.create_index("ix_employees_email", "employees", ["email"])
    op.create_index("ix_employees_is_active", "employees", ["is_active"])


def downgrade() -> None:
    op.drop_index("ix_employees_is_active", table_name="employees")
    op.drop_index("ix_employees_email", table_name="employees")
    op.drop_index("ix_employees_phone", table_name="employees")
    op.drop_index("ix_employees_organization_id", table_name="employees")
    op.drop_index("ix_employees_full_name", table_name="employees")
    op.drop_table("employees")
