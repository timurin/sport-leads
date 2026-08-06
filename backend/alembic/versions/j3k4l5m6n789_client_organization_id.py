"""Add Client.organization_id default org link (v1.00 / 0.4.2 UX).

Revision ID: j3k4l5m6n789
Revises: i2j3k4l5m678
Create Date: 2026-08-05 17:35:00.000000

"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "j3k4l5m6n789"
down_revision: Union[str, Sequence[str], None] = "i2j3k4l5m678"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "clients",
        sa.Column("organization_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_clients_organization_id_organizations",
        "clients",
        "organizations",
        ["organization_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_clients_organization_id", "clients", ["organization_id"])


def downgrade() -> None:
    op.drop_index("ix_clients_organization_id", table_name="clients")
    op.drop_constraint(
        "fk_clients_organization_id_organizations",
        "clients",
        type_="foreignkey",
    )
    op.drop_column("clients", "organization_id")
