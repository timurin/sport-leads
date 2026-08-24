"""Add client folders + Client.folder_id (2.2.4).

Revision ID: v6w7x8y9z012
Revises: u5v6w7x8y901
Roadmap: 2.2.4
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "v6w7x8y9z012"
down_revision = "u5v6w7x8y901"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "client_folders",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "parent_id",
            sa.Integer(),
            sa.ForeignKey("client_folders.id", ondelete="RESTRICT"),
            nullable=True,
        ),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column(
            "sort_order",
            sa.Integer(),
            nullable=False,
            server_default="0",
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
        sa.CheckConstraint(
            "sort_order >= 0",
            name="ck_client_folders_sort_order_nonnegative",
        ),
    )
    op.create_index("ix_client_folders_parent_id", "client_folders", ["parent_id"])
    op.create_index("ix_client_folders_name", "client_folders", ["name"])

    op.add_column(
        "clients",
        sa.Column(
            "folder_id",
            sa.Integer(),
            sa.ForeignKey("client_folders.id", ondelete="RESTRICT"),
            nullable=True,
        ),
    )
    op.create_index("ix_clients_folder_id", "clients", ["folder_id"])


def downgrade() -> None:
    op.drop_index("ix_clients_folder_id", table_name="clients")
    op.drop_column("clients", "folder_id")
    op.drop_index("ix_client_folders_name", table_name="client_folders")
    op.drop_index("ix_client_folders_parent_id", table_name="client_folders")
    op.drop_table("client_folders")
