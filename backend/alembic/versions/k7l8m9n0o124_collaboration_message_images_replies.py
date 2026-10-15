"""Chat images and reply links on collaboration messages.

Revision ID: k7l8m9n0o124
Revises: f2a3b4c5d6e7
"""

from alembic import op
import sqlalchemy as sa

revision = "k7l8m9n0o124"
down_revision = "f2a3b4c5d6e7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())
    if "collaboration_message_attachments" not in tables:
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
    message_columns = {column["name"] for column in inspector.get_columns("collaboration_messages")}
    if "reply_to_message_id" not in message_columns:
        op.add_column(
            "collaboration_messages",
            sa.Column("reply_to_message_id", sa.Integer(), nullable=True),
        )
        op.create_index(
            "ix_collaboration_messages_reply_to_message_id",
            "collaboration_messages",
            ["reply_to_message_id"],
        )
        op.create_foreign_key(
            "fk_collaboration_messages_reply_to_message_id",
            "collaboration_messages",
            "collaboration_messages",
            ["reply_to_message_id"],
            ["id"],
            ondelete="SET NULL",
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    message_columns = {column["name"] for column in inspector.get_columns("collaboration_messages")}
    if "reply_to_message_id" in message_columns:
        op.drop_constraint(
            "fk_collaboration_messages_reply_to_message_id",
            "collaboration_messages",
            type_="foreignkey",
        )
        op.drop_index(
            "ix_collaboration_messages_reply_to_message_id",
            table_name="collaboration_messages",
        )
        op.drop_column("collaboration_messages", "reply_to_message_id")
    tables = set(inspector.get_table_names())
    if "collaboration_message_attachments" in tables:
        op.drop_index(
            "ix_collaboration_message_attachments_message_id",
            table_name="collaboration_message_attachments",
        )
        op.drop_table("collaboration_message_attachments")
