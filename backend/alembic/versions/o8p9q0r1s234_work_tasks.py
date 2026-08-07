"""Add work_tasks / messages / attachments (ADR-028 / 23.1.2).

Revision ID: o8p9q0r1s234
Revises: n7o8p9q0r123
Create Date: 2026-08-06
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "o8p9q0r1s234"
down_revision: Union[str, Sequence[str], None] = "n7o8p9q0r123"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "work_tasks",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column(
            "status",
            sa.String(length=20),
            nullable=False,
            server_default="open",
        ),
        sa.Column("production_stage_id", sa.Integer(), nullable=True),
        sa.Column("responsible_platform_user_id", sa.Integer(), nullable=True),
        sa.Column("executor_platform_user_id", sa.Integer(), nullable=True),
        sa.Column("lead_id", sa.Integer(), nullable=True),
        sa.Column("sales_order_id", sa.Integer(), nullable=True),
        sa.Column("production_order_id", sa.Integer(), nullable=True),
        sa.Column("due_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["production_stage_id"],
            ["production_stages.id"],
            name="fk_work_tasks_production_stage_id",
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["responsible_platform_user_id"],
            ["platform_users.id"],
            name="fk_work_tasks_responsible_platform_user_id",
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["executor_platform_user_id"],
            ["platform_users.id"],
            name="fk_work_tasks_executor_platform_user_id",
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["lead_id"],
            ["leads.id"],
            name="fk_work_tasks_lead_id",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["sales_order_id"],
            ["sales_orders.id"],
            name="fk_work_tasks_sales_order_id",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["production_order_id"],
            ["production_orders.id"],
            name="fk_work_tasks_production_order_id",
            ondelete="CASCADE",
        ),
        sa.CheckConstraint(
            "("
            "(lead_id IS NOT NULL AND sales_order_id IS NULL AND production_order_id IS NULL) "
            "OR (lead_id IS NULL AND sales_order_id IS NOT NULL AND production_order_id IS NULL) "
            "OR (lead_id IS NULL AND sales_order_id IS NULL AND production_order_id IS NOT NULL)"
            ")",
            name="ck_work_tasks_anchor_xor",
        ),
    )
    op.create_index("ix_work_tasks_status", "work_tasks", ["status"])
    op.create_index("ix_work_tasks_lead_id", "work_tasks", ["lead_id"])
    op.create_index("ix_work_tasks_sales_order_id", "work_tasks", ["sales_order_id"])
    op.create_index(
        "ix_work_tasks_production_order_id",
        "work_tasks",
        ["production_order_id"],
    )
    op.create_index(
        "ix_work_tasks_production_stage_id",
        "work_tasks",
        ["production_stage_id"],
    )
    op.create_index(
        "ix_work_tasks_responsible_platform_user_id",
        "work_tasks",
        ["responsible_platform_user_id"],
    )
    op.create_index(
        "ix_work_tasks_executor_platform_user_id",
        "work_tasks",
        ["executor_platform_user_id"],
    )

    op.create_table(
        "work_task_messages",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("work_task_id", sa.Integer(), nullable=False),
        sa.Column("author_platform_user_id", sa.Integer(), nullable=False),
        sa.Column("body", sa.Text(), nullable=False, server_default=""),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(
            ["work_task_id"],
            ["work_tasks.id"],
            name="fk_work_task_messages_work_task_id",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["author_platform_user_id"],
            ["platform_users.id"],
            name="fk_work_task_messages_author_platform_user_id",
            ondelete="RESTRICT",
        ),
    )
    op.create_index(
        "ix_work_task_messages_work_task_id",
        "work_task_messages",
        ["work_task_id"],
    )
    op.create_index(
        "ix_work_task_messages_created_at",
        "work_task_messages",
        ["created_at"],
    )
    op.create_index(
        "ix_work_task_messages_author_platform_user_id",
        "work_task_messages",
        ["author_platform_user_id"],
    )

    op.create_table(
        "work_task_attachments",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("message_id", sa.Integer(), nullable=False),
        sa.Column("storage_key", sa.String(length=500), nullable=False),
        sa.Column("mime_type", sa.String(length=100), nullable=False),
        sa.Column("size_bytes", sa.Integer(), nullable=False),
        sa.Column("original_filename", sa.String(length=255), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(
            ["message_id"],
            ["work_task_messages.id"],
            name="fk_work_task_attachments_message_id",
            ondelete="CASCADE",
        ),
        sa.UniqueConstraint(
            "storage_key",
            name="ix_work_task_attachments_storage_key",
        ),
    )
    op.create_index(
        "ix_work_task_attachments_message_id",
        "work_task_attachments",
        ["message_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_work_task_attachments_message_id", table_name="work_task_attachments")
    op.drop_table("work_task_attachments")
    op.drop_index(
        "ix_work_task_messages_author_platform_user_id",
        table_name="work_task_messages",
    )
    op.drop_index("ix_work_task_messages_created_at", table_name="work_task_messages")
    op.drop_index("ix_work_task_messages_work_task_id", table_name="work_task_messages")
    op.drop_table("work_task_messages")
    op.drop_index("ix_work_tasks_executor_platform_user_id", table_name="work_tasks")
    op.drop_index("ix_work_tasks_responsible_platform_user_id", table_name="work_tasks")
    op.drop_index("ix_work_tasks_production_stage_id", table_name="work_tasks")
    op.drop_index("ix_work_tasks_production_order_id", table_name="work_tasks")
    op.drop_index("ix_work_tasks_sales_order_id", table_name="work_tasks")
    op.drop_index("ix_work_tasks_lead_id", table_name="work_tasks")
    op.drop_index("ix_work_tasks_status", table_name="work_tasks")
    op.drop_table("work_tasks")
