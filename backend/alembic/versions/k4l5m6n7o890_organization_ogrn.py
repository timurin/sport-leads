"""Add Organization.ogrn (v1.00 / 0.4.2 order-create UX).

Revision ID: k4l5m6n7o890
Revises: j3k4l5m6n789
Create Date: 2026-08-05 18:10:00.000000

"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "k4l5m6n7o890"
down_revision: Union[str, Sequence[str], None] = "j3k4l5m6n789"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "organizations",
        sa.Column("ogrn", sa.String(length=15), nullable=True),
    )
    op.create_index("ix_organizations_ogrn", "organizations", ["ogrn"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_organizations_ogrn", table_name="organizations")
    op.drop_column("organizations", "ogrn")
