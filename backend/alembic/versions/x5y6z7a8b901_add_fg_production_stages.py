"""Seed FG production stages ready_to_ship / shipped (11.2.2.2 / ADR-019).

Revision ID: x5y6z7a8b901
Revises: w4x5y6z7a890
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "x5y6z7a8b901"
down_revision = "w4x5y6z7a890"
branch_labels = None
depends_on = None

FG_STAGES = [
    ("Готовы к отгрузке", "ready_to_ship", 80),
    ("Отгружены", "shipped", 90),
]


def upgrade() -> None:
    stages = sa.table(
        "production_stages",
        sa.column("name", sa.String),
        sa.column("code", sa.String),
        sa.column("is_active", sa.Boolean),
        sa.column("sort_order", sa.Integer),
    )
    conn = op.get_bind()
    existing = {
        row[0]
        for row in conn.execute(sa.text("SELECT code FROM production_stages")).fetchall()
    }
    for name, code, sort_order in FG_STAGES:
        if code in existing:
            continue
        op.bulk_insert(
            stages,
            [
                {
                    "name": name,
                    "code": code,
                    "is_active": True,
                    "sort_order": sort_order,
                }
            ],
        )


def downgrade() -> None:
    op.execute(
        sa.text(
            "DELETE FROM production_stages WHERE code IN ('ready_to_ship', 'shipped')"
        )
    )
