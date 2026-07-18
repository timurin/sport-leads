"""add persistent lead stages

Revision ID: e4b8a2c91d7f
Revises: c12f0f2d0f4b
Create Date: 2026-07-18 20:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = "e4b8a2c91d7f"
down_revision: str | None = "c12f0f2d0f4b"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


DEFAULT_STAGES = (
    ("new", "Новый", "bg-blue-500"),
    ("contact", "Первичный контакт", "bg-cyan-500"),
    ("qualification", "Квалификация", "bg-violet-500"),
    ("proposal", "Предложение", "bg-amber-500"),
    ("waiting", "Ожидание решения", "bg-orange-500"),
)


def upgrade() -> None:
    op.create_table(
        "lead_stages",
        sa.Column("id", sa.String(length=64), nullable=False),
        sa.Column("title", sa.String(length=100), nullable=False),
        sa.Column("accent_class", sa.String(length=32), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.Column("is_system", sa.Boolean(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint("sort_order >= 0", name="ck_lead_stages_sort_order_nonnegative"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("sort_order"),
    )
    op.create_index(op.f("ix_lead_stages_is_active"), "lead_stages", ["is_active"])
    stages = sa.table(
        "lead_stages",
        sa.column("id", sa.String()),
        sa.column("title", sa.String()),
        sa.column("accent_class", sa.String()),
        sa.column("is_active", sa.Boolean()),
        sa.column("sort_order", sa.Integer()),
        sa.column("is_system", sa.Boolean()),
    )
    op.bulk_insert(
        stages,
        [
            {
                "id": stage_id,
                "title": title,
                "accent_class": accent_class,
                "is_active": True,
                "sort_order": sort_order,
                "is_system": True,
            }
            for sort_order, (stage_id, title, accent_class) in enumerate(DEFAULT_STAGES)
        ],
    )
    op.alter_column(
        "leads",
        "status",
        existing_type=sa.String(length=13),
        type_=sa.String(length=64),
        existing_nullable=False,
    )


def downgrade() -> None:
    op.execute(
        "UPDATE leads SET status = 'new' "
        "WHERE status NOT IN ('new', 'contact', 'qualification', 'proposal', 'waiting', 'completed')"
    )
    op.alter_column(
        "leads",
        "status",
        existing_type=sa.String(length=64),
        type_=sa.String(length=13),
        existing_nullable=False,
    )
    op.drop_index(op.f("ix_lead_stages_is_active"), table_name="lead_stages")
    op.drop_table("lead_stages")
