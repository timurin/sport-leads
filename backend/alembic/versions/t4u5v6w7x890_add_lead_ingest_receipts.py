"""add lead_ingest_receipts for website-form CRM ingest

Revision ID: t4u5v6w7x890
Revises: s3t4u5v6w789
Create Date: 2026-08-23
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "t4u5v6w7x890"
down_revision: Union[str, Sequence[str], None] = "s3t4u5v6w789"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "lead_ingest_receipts",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("adapter_type", sa.String(length=64), nullable=False),
        sa.Column("external_id", sa.String(length=255), nullable=False),
        sa.Column("lead_id", sa.Integer(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["lead_id"], ["leads.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "adapter_type",
            "external_id",
            name="uq_lead_ingest_receipts_adapter_external",
        ),
    )
    op.create_index(
        op.f("ix_lead_ingest_receipts_adapter_type"),
        "lead_ingest_receipts",
        ["adapter_type"],
    )
    op.create_index(
        op.f("ix_lead_ingest_receipts_lead_id"),
        "lead_ingest_receipts",
        ["lead_id"],
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_lead_ingest_receipts_lead_id"), table_name="lead_ingest_receipts")
    op.drop_index(
        op.f("ix_lead_ingest_receipts_adapter_type"),
        table_name="lead_ingest_receipts",
    )
    op.drop_table("lead_ingest_receipts")
