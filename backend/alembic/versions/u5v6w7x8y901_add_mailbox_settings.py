"""add mailbox_settings singleton for CRM email connector

Revision ID: u5v6w7x8y901
Revises: t4u5v6w7x890
Create Date: 2026-08-23
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "u5v6w7x8y901"
down_revision: Union[str, Sequence[str], None] = "t4u5v6w7x890"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "mailbox_settings",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column(
            "display_name",
            sa.String(length=255),
            nullable=False,
            server_default="Корпоративная почта",
        ),
        sa.Column("email_address", sa.String(length=255), nullable=True),
        sa.Column("smtp_enabled", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("smtp_host", sa.String(length=255), nullable=True),
        sa.Column("smtp_port", sa.Integer(), nullable=False, server_default="587"),
        sa.Column("smtp_use_tls", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("smtp_username", sa.String(length=255), nullable=True),
        sa.Column("smtp_password", sa.Text(), nullable=True),
        sa.Column("smtp_from", sa.String(length=255), nullable=True),
        sa.Column("imap_enabled", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("imap_host", sa.String(length=255), nullable=True),
        sa.Column("imap_port", sa.Integer(), nullable=False, server_default="993"),
        sa.Column("imap_use_tls", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("imap_username", sa.String(length=255), nullable=True),
        sa.Column("imap_password", sa.Text(), nullable=True),
        sa.Column("inbound_webhook_secret", sa.Text(), nullable=True),
        sa.Column(
            "create_lead_from_unknown",
            sa.Boolean(),
            nullable=False,
            server_default="false",
        ),
        sa.Column(
            "lead_source_label",
            sa.String(length=150),
            nullable=False,
            server_default="email",
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
        sa.CheckConstraint("id = 1", name="ck_mailbox_settings_singleton_id"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.execute(
        sa.text(
            """
            INSERT INTO mailbox_settings (id, display_name, lead_source_label)
            VALUES (1, 'Корпоративная почта', 'email')
            """
        )
    )


def downgrade() -> None:
    op.drop_table("mailbox_settings")
