"""Seed sewing cabinet permissions and roles (24.1.1).

Revision ID: z0a1b2c3d456
Revises: y9z0a1b2c345
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "z0a1b2c3d456"
down_revision = "y9z0a1b2c345"
branch_labels = None
depends_on = None

_PERMISSIONS: tuple[tuple[str, str], ...] = (
    (
        "sewing_cabinet.read_own",
        "Read own sewing cabinet queue and earnings",
    ),
    (
        "sewing_cabinet.read_any",
        "Read any sewer cabinet and sewer list",
    ),
    (
        "sewing_cabinet.write",
        "Take / release / complete sewing work ledger rows",
    ),
)

_ROLES: tuple[tuple[str, str], ...] = (
    ("sewer", "Sewer"),
    ("company_lead", "Company lead"),
    ("technologist", "Technologist"),
    ("shop_master", "Shop master"),
)

_ROLE_PERMISSIONS: tuple[tuple[str, str], ...] = (
    ("sewer", "sewing_cabinet.read_own"),
    ("sewer", "sewing_cabinet.write"),
    ("company_lead", "sewing_cabinet.read_any"),
    ("company_lead", "sewing_cabinet.write"),
    ("technologist", "sewing_cabinet.read_any"),
    ("technologist", "sewing_cabinet.write"),
    ("shop_master", "sewing_cabinet.read_any"),
    ("shop_master", "sewing_cabinet.write"),
    ("admin", "sewing_cabinet.read_own"),
    ("admin", "sewing_cabinet.read_any"),
    ("admin", "sewing_cabinet.write"),
)


def upgrade() -> None:
    for code, description in _PERMISSIONS:
        op.execute(
            sa.text(
                "INSERT INTO permissions (code, description) "
                "SELECT :code, :description "
                "WHERE NOT EXISTS ("
                "  SELECT 1 FROM permissions WHERE code = :code"
                ")"
            ).bindparams(code=code, description=description)
        )
    for code, name in _ROLES:
        op.execute(
            sa.text(
                "INSERT INTO roles (code, name, is_system) "
                "SELECT :code, :name, true "
                "WHERE NOT EXISTS ("
                "  SELECT 1 FROM roles WHERE code = :code"
                ")"
            ).bindparams(code=code, name=name)
        )
    for role_code, perm_code in _ROLE_PERMISSIONS:
        op.execute(
            sa.text(
                "INSERT INTO role_permissions (role_id, permission_id) "
                "SELECT r.id, p.id FROM roles r, permissions p "
                "WHERE r.code = :role_code AND p.code = :perm_code "
                "AND NOT EXISTS ("
                "  SELECT 1 FROM role_permissions rp "
                "  WHERE rp.role_id = r.id AND rp.permission_id = p.id"
                ")"
            ).bindparams(role_code=role_code, perm_code=perm_code)
        )


def downgrade() -> None:
    for role_code, _name in _ROLES:
        op.execute(
            sa.text(
                "DELETE FROM platform_user_roles WHERE role_id IN "
                "(SELECT id FROM roles WHERE code = :role_code)"
            ).bindparams(role_code=role_code)
        )
    for _role_code, perm_code in _ROLE_PERMISSIONS:
        op.execute(
            sa.text(
                "DELETE FROM role_permissions WHERE permission_id IN "
                "(SELECT id FROM permissions WHERE code = :perm_code)"
            ).bindparams(perm_code=perm_code)
        )
    for role_code, _name in _ROLES:
        op.execute(
            sa.text("DELETE FROM roles WHERE code = :role_code").bindparams(
                role_code=role_code
            )
        )
    for perm_code, _desc in _PERMISSIONS:
        op.execute(
            sa.text(
                "DELETE FROM permissions WHERE code = :perm_code"
            ).bindparams(perm_code=perm_code)
        )
