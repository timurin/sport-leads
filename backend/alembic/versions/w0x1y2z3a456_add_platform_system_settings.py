"""Alembic: platform_system_settings singleton + system_settings.write (18.1.2).

Revision ID: w0x1y2z3a456
Revises: v9w0x1y2z345
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "w0x1y2z3a456"
down_revision = "v9w0x1y2z345"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "platform_system_settings",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("organization_display_name", sa.String(length=255), nullable=False),
        sa.Column("default_timezone", sa.String(length=64), nullable=False),
        sa.Column("support_email", sa.String(length=255), nullable=True),
        sa.Column("ui_locale", sa.String(length=16), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint("id = 1", name="ck_platform_system_settings_singleton_id"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.execute(
        sa.text(
            """
            INSERT INTO platform_system_settings (
                id,
                organization_display_name,
                default_timezone,
                support_email,
                ui_locale,
                notes
            ) VALUES (
                1,
                'Sport-Lead',
                'Europe/Moscow',
                NULL,
                'ru-RU',
                NULL
            )
            """
        )
    )
    op.execute(
        sa.text(
            "INSERT INTO permissions (code, description) "
            "SELECT 'system_settings.write', "
            "'Update platform system settings' "
            "WHERE NOT EXISTS ("
            "  SELECT 1 FROM permissions WHERE code = 'system_settings.write'"
            ")"
        )
    )
    op.execute(
        sa.text(
            "INSERT INTO role_permissions (role_id, permission_id) "
            "SELECT r.id, p.id FROM roles r, permissions p "
            "WHERE r.code = 'admin' AND p.code = 'system_settings.write' "
            "AND NOT EXISTS ("
            "  SELECT 1 FROM role_permissions rp "
            "  WHERE rp.role_id = r.id AND rp.permission_id = p.id"
            ")"
        )
    )


def downgrade() -> None:
    op.execute(
        sa.text(
            "DELETE FROM role_permissions WHERE permission_id IN "
            "(SELECT id FROM permissions WHERE code = 'system_settings.write')"
        )
    )
    op.execute(
        sa.text("DELETE FROM permissions WHERE code = 'system_settings.write'")
    )
    op.drop_table("platform_system_settings")
