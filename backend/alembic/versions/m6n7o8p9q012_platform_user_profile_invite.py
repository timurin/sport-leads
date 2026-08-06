"""PlatformUser profile + invite_status (v1.00 / 21.2.2).

Revision ID: m6n7o8p9q012
Revises: l5m6n7o8p901
Create Date: 2026-08-05 19:55:00.000000

"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "m6n7o8p9q012"
down_revision: Union[str, Sequence[str], None] = "l5m6n7o8p901"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "platform_users",
        sa.Column("email", sa.String(length=255), nullable=True),
    )
    op.add_column(
        "platform_users",
        sa.Column("phone", sa.String(length=64), nullable=True),
    )
    op.add_column(
        "platform_users",
        sa.Column("department", sa.String(length=150), nullable=True),
    )
    op.add_column(
        "platform_users",
        sa.Column("position", sa.String(length=150), nullable=True),
    )
    op.add_column(
        "platform_users",
        sa.Column("manager_platform_user_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_platform_users_manager_platform_user_id",
        "platform_users",
        "platform_users",
        ["manager_platform_user_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.add_column(
        "platform_users",
        sa.Column(
            "language",
            sa.String(length=16),
            nullable=False,
            server_default="ru",
        ),
    )
    op.add_column(
        "platform_users",
        sa.Column(
            "invite_status",
            sa.String(length=20),
            nullable=False,
            server_default="active",
        ),
    )
    op.add_column(
        "platform_users",
        sa.Column("last_activity_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "ix_platform_users_invite_status",
        "platform_users",
        ["invite_status"],
        unique=False,
    )
    op.create_index(
        "ix_platform_users_email",
        "platform_users",
        ["email"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_platform_users_email", table_name="platform_users")
    op.drop_index("ix_platform_users_invite_status", table_name="platform_users")
    op.drop_column("platform_users", "last_activity_at")
    op.drop_column("platform_users", "invite_status")
    op.drop_column("platform_users", "language")
    op.drop_constraint(
        "fk_platform_users_manager_platform_user_id",
        "platform_users",
        type_="foreignkey",
    )
    op.drop_column("platform_users", "manager_platform_user_id")
    op.drop_column("platform_users", "position")
    op.drop_column("platform_users", "department")
    op.drop_column("platform_users", "phone")
    op.drop_column("platform_users", "email")
