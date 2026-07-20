"""add nomenclature media

Revision ID: h8c9d0e1f234
Revises: g7b8c9d0e123
"""
import sqlalchemy as sa
from alembic import op

revision = "h8c9d0e1f234"
down_revision = "g7b8c9d0e123"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "nomenclature_media",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("nomenclature_id", sa.Integer(), nullable=False),
        sa.Column("filename", sa.String(255), nullable=False),
        sa.Column("storage_key", sa.String(500), nullable=False),
        sa.Column("mime_type", sa.String(100), nullable=False),
        sa.Column("file_size", sa.Integer(), nullable=False),
        sa.Column("alt_text", sa.String(255)),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_primary", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["nomenclature_id"], ["nomenclatures.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("storage_key", name="uq_nomenclature_media_storage_key"),
        sa.CheckConstraint("file_size > 0", name="ck_nomenclature_media_file_size_positive"),
        sa.CheckConstraint("sort_order >= 0", name="ck_nomenclature_media_sort_order_nonnegative"),
    )
    op.create_index("ix_nomenclature_media_nomenclature_id", "nomenclature_media", ["nomenclature_id"])
    op.create_index("ix_nomenclature_media_is_primary", "nomenclature_media", ["is_primary"])


def downgrade() -> None:
    op.drop_index("ix_nomenclature_media_is_primary", table_name="nomenclature_media")
    op.drop_index("ix_nomenclature_media_nomenclature_id", table_name="nomenclature_media")
    op.drop_table("nomenclature_media")
