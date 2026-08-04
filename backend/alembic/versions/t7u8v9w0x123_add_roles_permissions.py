"""Alembic: roles/permissions RBAC (ADR-024 / 17.1.2.2).

Revision ID: t7u8v9w0x123
Revises: s6t7u8v9w012
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "t7u8v9w0x123"
down_revision = "s6t7u8v9w012"
branch_labels = None
depends_on = None

PERMISSIONS = [
    ("size_grids.write", "Create/update/delete size grids and rows"),
    ("shop.kanban.transition", "Shop kanban stage complete / rollback-kanban"),
    ("admin.roles.assign", "Assign or revoke roles on platform users"),
]

ROLES = [
    ("admin", "Administrator", True),
    ("catalog_editor", "Catalog editor", True),
    ("shop_operator", "Shop operator", True),
]

ROLE_PERMS = {
    "admin": [
        "size_grids.write",
        "shop.kanban.transition",
        "admin.roles.assign",
    ],
    "catalog_editor": ["size_grids.write"],
    "shop_operator": ["shop.kanban.transition"],
}


def upgrade() -> None:
    op.create_table(
        "permissions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("code", sa.String(length=64), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.UniqueConstraint("code", name="uq_permissions_code"),
    )
    op.create_index("ix_permissions_code", "permissions", ["code"])

    op.create_table(
        "roles",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("code", sa.String(length=64), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column(
            "is_system",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.UniqueConstraint("code", name="uq_roles_code"),
    )
    op.create_index("ix_roles_code", "roles", ["code"])

    op.create_table(
        "role_permissions",
        sa.Column(
            "role_id",
            sa.Integer(),
            sa.ForeignKey("roles.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "permission_id",
            sa.Integer(),
            sa.ForeignKey("permissions.id", ondelete="CASCADE"),
            primary_key=True,
        ),
    )
    op.create_table(
        "platform_user_roles",
        sa.Column(
            "platform_user_id",
            sa.Integer(),
            sa.ForeignKey("platform_users.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "role_id",
            sa.Integer(),
            sa.ForeignKey("roles.id", ondelete="CASCADE"),
            primary_key=True,
        ),
    )

    permissions = sa.table(
        "permissions",
        sa.column("id", sa.Integer),
        sa.column("code", sa.String),
        sa.column("description", sa.Text),
    )
    roles = sa.table(
        "roles",
        sa.column("id", sa.Integer),
        sa.column("code", sa.String),
        sa.column("name", sa.String),
        sa.column("is_system", sa.Boolean),
    )
    role_permissions = sa.table(
        "role_permissions",
        sa.column("role_id", sa.Integer),
        sa.column("permission_id", sa.Integer),
    )
    platform_user_roles = sa.table(
        "platform_user_roles",
        sa.column("platform_user_id", sa.Integer),
        sa.column("role_id", sa.Integer),
    )
    platform_users = sa.table(
        "platform_users",
        sa.column("id", sa.Integer),
        sa.column("login", sa.String),
    )

    op.bulk_insert(
        permissions,
        [{"code": code, "description": desc} for code, desc in PERMISSIONS],
    )
    op.bulk_insert(
        roles,
        [
            {"code": code, "name": name, "is_system": is_system}
            for code, name, is_system in ROLES
        ],
    )

    bind = op.get_bind()
    perm_rows = {
        row.code: row.id
        for row in bind.execute(sa.select(permissions.c.id, permissions.c.code))
    }
    role_rows = {
        row.code: row.id
        for row in bind.execute(sa.select(roles.c.id, roles.c.code))
    }
    link_rows = []
    for role_code, perm_codes in ROLE_PERMS.items():
        role_id = role_rows[role_code]
        for perm_code in perm_codes:
            link_rows.append(
                {"role_id": role_id, "permission_id": perm_rows[perm_code]}
            )
    if link_rows:
        op.bulk_insert(role_permissions, link_rows)

    admin_role_id = role_rows["admin"]
    user_ids = [
        row.id
        for row in bind.execute(sa.select(platform_users.c.id))
    ]
    if user_ids:
        op.bulk_insert(
            platform_user_roles,
            [
                {"platform_user_id": user_id, "role_id": admin_role_id}
                for user_id in user_ids
            ],
        )


def downgrade() -> None:
    op.drop_table("platform_user_roles")
    op.drop_table("role_permissions")
    op.drop_index("ix_roles_code", table_name="roles")
    op.drop_table("roles")
    op.drop_index("ix_permissions_code", table_name="permissions")
    op.drop_table("permissions")
