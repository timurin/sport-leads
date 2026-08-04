"""Alembic: platform_users + auth_sessions (ADR-023 / 17.1.1.2).

Revision ID: s6t7u8v9w012
Revises: r5s6t7u8v901
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "s6t7u8v9w012"
down_revision = "r5s6t7u8v901"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "platform_users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("login", sa.String(length=64), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("display_name", sa.String(length=255), nullable=False),
        sa.Column(
            "is_active",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
        sa.Column(
            "sales_user_id",
            sa.Integer(),
            sa.ForeignKey("sales_users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.UniqueConstraint("login", name="uq_platform_users_login"),
    )
    op.create_index("ix_platform_users_login", "platform_users", ["login"])
    op.create_index(
        "ix_platform_users_sales_user_id", "platform_users", ["sales_user_id"]
    )

    op.create_table(
        "auth_sessions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "platform_user_id",
            sa.Integer(),
            sa.ForeignKey("platform_users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("user_agent", sa.String(length=512), nullable=True),
        sa.Column("ip_address", sa.String(length=64), nullable=True),
        sa.UniqueConstraint("token_hash", name="uq_auth_sessions_token_hash"),
    )
    op.create_index(
        "ix_auth_sessions_platform_user_id",
        "auth_sessions",
        ["platform_user_id"],
    )
    op.create_index("ix_auth_sessions_token_hash", "auth_sessions", ["token_hash"])


def downgrade() -> None:
    op.drop_index("ix_auth_sessions_token_hash", table_name="auth_sessions")
    op.drop_index(
        "ix_auth_sessions_platform_user_id", table_name="auth_sessions"
    )
    op.drop_table("auth_sessions")
    op.drop_index("ix_platform_users_sales_user_id", table_name="platform_users")
    op.drop_index("ix_platform_users_login", table_name="platform_users")
    op.drop_table("platform_users")
