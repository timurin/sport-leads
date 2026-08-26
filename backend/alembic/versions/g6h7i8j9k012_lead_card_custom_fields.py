"""Lead card extra fields + RBAC seed (26.5).

Revision ID: g6h7i8j9k012
Revises: f5a6b7c8d901
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "g6h7i8j9k012"
down_revision = "f5a6b7c8d901"
branch_labels = None
depends_on = None

_PERM_CODE = "leads.card_fields.manage"
_PERM_DESC = "Create and delete extra fields on the lead card"


def upgrade() -> None:
    op.create_table(
        "lead_card_field_definitions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("block", sa.String(length=32), nullable=False),
        sa.Column("label", sa.String(length=120), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
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
        sa.CheckConstraint(
            "block IN ('customer', 'interest', 'delivery', 'metrics')",
            name="ck_lead_card_field_definitions_block",
        ),
        sa.CheckConstraint(
            "sort_order >= 0",
            name="ck_lead_card_field_definitions_sort_order",
        ),
    )
    op.create_index(
        "ix_lead_card_field_definitions_block",
        "lead_card_field_definitions",
        ["block"],
    )
    op.create_table(
        "lead_card_field_values",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("lead_id", sa.Integer(), nullable=False),
        sa.Column("definition_id", sa.Integer(), nullable=False),
        sa.Column("value", sa.Text(), nullable=False, server_default=""),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.ForeignKeyConstraint(
            ["lead_id"],
            ["leads.id"],
            name="fk_lead_card_field_values_lead_id",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["definition_id"],
            ["lead_card_field_definitions.id"],
            name="fk_lead_card_field_values_definition_id",
            ondelete="CASCADE",
        ),
        sa.UniqueConstraint(
            "lead_id",
            "definition_id",
            name="uq_lead_card_field_values_lead_definition",
        ),
    )
    op.create_index(
        "ix_lead_card_field_values_lead_id",
        "lead_card_field_values",
        ["lead_id"],
    )
    op.create_index(
        "ix_lead_card_field_values_definition_id",
        "lead_card_field_values",
        ["definition_id"],
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
    op.drop_index("ix_lead_card_field_values_definition_id", table_name="lead_card_field_values")
    op.drop_index("ix_lead_card_field_values_lead_id", table_name="lead_card_field_values")
    op.drop_table("lead_card_field_values")
    op.drop_index(
        "ix_lead_card_field_definitions_block",
        table_name="lead_card_field_definitions",
    )
    op.drop_table("lead_card_field_definitions")
