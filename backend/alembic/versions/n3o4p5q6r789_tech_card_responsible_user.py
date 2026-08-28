"""Tech-card creator / responsible PlatformUser + create permission (26.3.6).

Revision ID: n3o4p5q6r789
Revises: m2n3o4p5q678
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "n3o4p5q6r789"
down_revision = "m2n3o4p5q678"
branch_labels = None
depends_on = None

_PERM_CODE = "technical_cards.create"
_PERM_DESC = "Create technical cards (generate / standalone)"


def upgrade() -> None:
    op.add_column(
        "technical_cards",
        sa.Column("created_by_platform_user_id", sa.Integer(), nullable=True),
    )
    op.add_column(
        "technical_cards",
        sa.Column("responsible_platform_user_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_technical_cards_created_by_platform_user_id",
        "technical_cards",
        "platform_users",
        ["created_by_platform_user_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        "fk_technical_cards_responsible_platform_user_id",
        "technical_cards",
        "platform_users",
        ["responsible_platform_user_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        "ix_technical_cards_created_by_platform_user_id",
        "technical_cards",
        ["created_by_platform_user_id"],
    )
    op.create_index(
        "ix_technical_cards_responsible_platform_user_id",
        "technical_cards",
        ["responsible_platform_user_id"],
    )
    op.execute(
        sa.text(
            "INSERT INTO permissions (code, description) "
            "SELECT :code, :description "
            "WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE code = :code)"
        ).bindparams(code=_PERM_CODE, description=_PERM_DESC)
    )
    op.execute(
        sa.text(
            "INSERT INTO role_permissions (role_id, permission_id) "
            "SELECT r.id, p.id FROM roles r, permissions p "
            "WHERE r.code = 'admin' AND p.code = :perm_code "
            "AND NOT EXISTS ("
            "  SELECT 1 FROM role_permissions rp "
            "  WHERE rp.role_id = r.id AND rp.permission_id = p.id"
            ")"
        ).bindparams(perm_code=_PERM_CODE)
    )


def downgrade() -> None:
    op.execute(
        sa.text(
            "DELETE FROM role_permissions WHERE permission_id IN "
            "(SELECT id FROM permissions WHERE code = :perm_code)"
        ).bindparams(perm_code=_PERM_CODE)
    )
    op.execute(
        sa.text("DELETE FROM permissions WHERE code = :perm_code").bindparams(
            perm_code=_PERM_CODE
        )
    )
    op.drop_index(
        "ix_technical_cards_responsible_platform_user_id",
        table_name="technical_cards",
    )
    op.drop_index(
        "ix_technical_cards_created_by_platform_user_id",
        table_name="technical_cards",
    )
    op.drop_constraint(
        "fk_technical_cards_responsible_platform_user_id",
        "technical_cards",
        type_="foreignkey",
    )
    op.drop_constraint(
        "fk_technical_cards_created_by_platform_user_id",
        "technical_cards",
        type_="foreignkey",
    )
    op.drop_column("technical_cards", "responsible_platform_user_id")
    op.drop_column("technical_cards", "created_by_platform_user_id")
