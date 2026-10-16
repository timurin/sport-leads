"""Images on collaboration messages.

Revision ID: h4i5j6k7l801
Revises: g3h4i5j6k790
"""

from alembic import op
import sqlalchemy as sa

revision = "h4i5j6k7l801"
down_revision = "g3h4i5j6k790"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "collaboration_message_attachments" in inspector.get_table_names():
        return
    op.create_table(
        "collaboration_message_attachments",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "message_id",
            sa.Integer(),
            sa.ForeignKey("collaboration_messages.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("filename", sa.String(length=255), nullable=False),
        sa.Column("storage_key", sa.String(length=500), nullable=False),
        sa.Column("mime_type", sa.String(length=100), nullable=False),
        sa.Column("file_size", sa.Integer(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.CheckConstraint(
            "file_size > 0",
            name="ck_collaboration_message_attachments_file_size",
        ),
        sa.UniqueConstraint(
            "storage_key",
            name="uq_collaboration_message_attachments_storage_key",
        ),
    )
    op.create_index(
        "ix_collaboration_message_attachments_message_id",
        "collaboration_message_attachments",
        ["message_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_collaboration_message_attachments_message_id",
        table_name="collaboration_message_attachments",
    )
    op.drop_table("collaboration_message_attachments")
