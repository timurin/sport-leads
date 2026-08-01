"""Add technical card media gallery and operation line source_kind / sewing link."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "n5o6p7q8r901"
down_revision = "m4n5o6p7q890"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "technical_card_operation_lines",
        sa.Column(
            "source_kind",
            sa.String(length=20),
            nullable=False,
            server_default="routing",
        ),
    )
    op.add_column(
        "technical_card_operation_lines",
        sa.Column("sewing_operation_id", sa.Integer(), nullable=True),
    )
    op.create_check_constraint(
        "ck_technical_card_operation_lines_source_kind",
        "technical_card_operation_lines",
        "source_kind IN ('routing', 'sewing')",
    )
    op.create_foreign_key(
        "fk_technical_card_operation_lines_sewing_operation_id",
        "technical_card_operation_lines",
        "sewing_operations",
        ["sewing_operation_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        "ix_technical_card_operation_lines_sewing_operation_id",
        "technical_card_operation_lines",
        ["sewing_operation_id"],
    )

    op.create_table(
        "technical_card_media",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("technical_card_id", sa.Integer(), nullable=False),
        sa.Column("filename", sa.String(length=255), nullable=False),
        sa.Column("storage_key", sa.String(length=500), nullable=False),
        sa.Column("mime_type", sa.String(length=100), nullable=False),
        sa.Column("file_size", sa.Integer(), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_primary", sa.Boolean(), nullable=False, server_default=sa.false()),
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
        sa.ForeignKeyConstraint(
            ["technical_card_id"],
            ["technical_cards.id"],
            ondelete="CASCADE",
        ),
        sa.UniqueConstraint("storage_key", name="uq_technical_card_media_storage_key"),
        sa.CheckConstraint("file_size > 0", name="ck_technical_card_media_file_size"),
        sa.CheckConstraint("sort_order >= 0", name="ck_technical_card_media_sort_order"),
    )
    op.create_index(
        "ix_technical_card_media_technical_card_id",
        "technical_card_media",
        ["technical_card_id"],
    )
    op.create_index(
        "ix_technical_card_media_is_primary",
        "technical_card_media",
        ["is_primary"],
    )


def downgrade() -> None:
    op.drop_index("ix_technical_card_media_is_primary", table_name="technical_card_media")
    op.drop_index(
        "ix_technical_card_media_technical_card_id", table_name="technical_card_media"
    )
    op.drop_table("technical_card_media")

    op.drop_index(
        "ix_technical_card_operation_lines_sewing_operation_id",
        table_name="technical_card_operation_lines",
    )
    op.drop_constraint(
        "fk_technical_card_operation_lines_sewing_operation_id",
        "technical_card_operation_lines",
        type_="foreignkey",
    )
    op.drop_constraint(
        "ck_technical_card_operation_lines_source_kind",
        "technical_card_operation_lines",
        type_="check",
    )
    op.drop_column("technical_card_operation_lines", "sewing_operation_id")
    op.drop_column("technical_card_operation_lines", "source_kind")
