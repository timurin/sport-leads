"""Reply link on collaboration messages.

Revision ID: j6k7l8m9n013
Revises: i5j6k7l8m912
"""

from alembic import op
import sqlalchemy as sa

revision = "j6k7l8m9n013"
down_revision = "i5j6k7l8m912"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {column["name"] for column in inspector.get_columns("collaboration_messages")}
    if "reply_to_message_id" in columns:
        return
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
