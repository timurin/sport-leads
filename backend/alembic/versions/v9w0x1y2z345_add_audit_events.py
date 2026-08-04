"""Alembic: audit_events + audit.read permission (17.1.3.2).

Revision ID: v9w0x1y2z345
Revises: u8v9w0x1y234
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "v9w0x1y2z345"
down_revision = "u8v9w0x1y234"
branch_labels = None
depends_on = None


def upgrade() -> None:
    json_type = (
        postgresql.JSONB(astext_type=sa.Text())
        if op.get_bind().dialect.name == "postgresql"
        else sa.JSON()
    )
    op.create_table(
        "audit_events",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "occurred_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "actor_platform_user_id",
            sa.Integer(),
            sa.ForeignKey("platform_users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("actor_login", sa.String(length=64), nullable=True),
        sa.Column("action", sa.String(length=128), nullable=False),
        sa.Column("entity_type", sa.String(length=64), nullable=False),
        sa.Column("entity_id", sa.String(length=64), nullable=False),
        sa.Column("request_id", sa.String(length=64), nullable=True),
        sa.Column("payload", json_type, nullable=True),
        sa.Column(
            "source",
            sa.String(length=32),
            nullable=False,
            server_default="api",
        ),
        sa.Column("notes", sa.Text(), nullable=True),
    )
    op.create_index("ix_audit_events_occurred_at", "audit_events", ["occurred_at"])
    op.create_index(
        "ix_audit_events_actor_platform_user_id",
        "audit_events",
        ["actor_platform_user_id"],
    )
    op.create_index("ix_audit_events_action", "audit_events", ["action"])
    op.create_index("ix_audit_events_entity_type", "audit_events", ["entity_type"])
    op.create_index("ix_audit_events_entity_id", "audit_events", ["entity_id"])
    op.create_index(
        "ix_audit_events_entity_lookup",
        "audit_events",
        ["entity_type", "entity_id"],
    )

    op.execute(
        sa.text(
            "INSERT INTO permissions (code, description) "
            "SELECT 'audit.read', 'Query platform audit events' "
            "WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE code = 'audit.read')"
        )
    )
    op.execute(
        sa.text(
            "INSERT INTO role_permissions (role_id, permission_id) "
            "SELECT r.id, p.id FROM roles r, permissions p "
            "WHERE r.code = 'admin' AND p.code = 'audit.read' "
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
            "(SELECT id FROM permissions WHERE code = 'audit.read')"
        )
    )
    op.execute(sa.text("DELETE FROM permissions WHERE code = 'audit.read'"))
    op.drop_index("ix_audit_events_entity_lookup", table_name="audit_events")
    op.drop_index("ix_audit_events_entity_id", table_name="audit_events")
    op.drop_index("ix_audit_events_entity_type", table_name="audit_events")
    op.drop_index("ix_audit_events_action", table_name="audit_events")
    op.drop_index(
        "ix_audit_events_actor_platform_user_id", table_name="audit_events"
    )
    op.drop_index("ix_audit_events_occurred_at", table_name="audit_events")
    op.drop_table("audit_events")
