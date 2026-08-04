"""Alembic: platform_cities + platform_directories.write (18.2.2).

Revision ID: y2z3a4b5c678
Revises: x1y2z3a4b567
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "y2z3a4b5c678"
down_revision = "x1y2z3a4b567"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "platform_cities",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("region", sa.String(length=120), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
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
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_platform_cities_name_lower",
        "platform_cities",
        [sa.text("lower(name)")],
        unique=True,
    )
    op.execute(
        sa.text(
            """
            INSERT INTO platform_cities (name, region, is_active, sort_order) VALUES
            ('Москва', 'Москва', true, 10),
            ('Санкт-Петербург', 'Санкт-Петербург', true, 20),
            ('Казань', 'Республика Татарстан', true, 30),
            ('Екатеринбург', 'Свердловская область', true, 40),
            ('Новосибирск', 'Новосибирская область', true, 50)
            """
        )
    )
    op.execute(
        sa.text(
            "INSERT INTO permissions (code, description) "
            "SELECT 'platform_directories.write', "
            "'Create/update/delete platform directory rows' "
            "WHERE NOT EXISTS ("
            "  SELECT 1 FROM permissions WHERE code = 'platform_directories.write'"
            ")"
        )
    )
    op.execute(
        sa.text(
            "INSERT INTO role_permissions (role_id, permission_id) "
            "SELECT r.id, p.id FROM roles r, permissions p "
            "WHERE r.code = 'admin' AND p.code = 'platform_directories.write' "
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
            "(SELECT id FROM permissions WHERE code = 'platform_directories.write')"
        )
    )
    op.execute(
        sa.text("DELETE FROM permissions WHERE code = 'platform_directories.write'")
    )
    op.drop_index("ix_platform_cities_name_lower", table_name="platform_cities")
    op.drop_table("platform_cities")
