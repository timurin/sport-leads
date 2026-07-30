"""Add production_orders, production_batches, batch↔TC links.

Revision ID: w4x5y6z7a890
Revises: v3w4x5y6z789
Roadmap: 11.1.1.2 / ADR-018
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "w4x5y6z7a890"
down_revision = "v3w4x5y6z789"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "production_orders",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("sales_order_id", sa.Integer(), nullable=False),
        sa.Column("number", sa.String(length=80), nullable=False),
        sa.Column("order_seq", sa.Integer(), nullable=False),
        sa.Column(
            "status",
            sa.String(length=20),
            nullable=False,
            server_default="draft",
        ),
        sa.Column("notes", sa.Text(), nullable=True),
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
        sa.ForeignKeyConstraint(
            ["sales_order_id"],
            ["sales_orders.id"],
            name="fk_production_orders_sales_order_id",
            ondelete="RESTRICT",
        ),
        sa.UniqueConstraint(
            "sales_order_id",
            "order_seq",
            name="uq_production_orders_sales_order_seq",
        ),
        sa.UniqueConstraint("number", name="uq_production_orders_number"),
    )
    op.create_index(
        "ix_production_orders_sales_order_id",
        "production_orders",
        ["sales_order_id"],
    )
    op.create_index("ix_production_orders_status", "production_orders", ["status"])

    op.create_table(
        "production_batches",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("production_order_id", sa.Integer(), nullable=False),
        sa.Column("number", sa.String(length=100), nullable=False),
        sa.Column("batch_seq", sa.Integer(), nullable=False),
        sa.Column(
            "status",
            sa.String(length=20),
            nullable=False,
            server_default="draft",
        ),
        sa.Column("notes", sa.Text(), nullable=True),
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
        sa.ForeignKeyConstraint(
            ["production_order_id"],
            ["production_orders.id"],
            name="fk_production_batches_production_order_id",
            ondelete="CASCADE",
        ),
        sa.UniqueConstraint(
            "production_order_id",
            "batch_seq",
            name="uq_production_batches_order_batch_seq",
        ),
        sa.UniqueConstraint("number", name="uq_production_batches_number"),
    )
    op.create_index(
        "ix_production_batches_production_order_id",
        "production_batches",
        ["production_order_id"],
    )
    op.create_index("ix_production_batches_status", "production_batches", ["status"])

    op.create_table(
        "production_batch_card_links",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("production_batch_id", sa.Integer(), nullable=False),
        sa.Column("technical_card_id", sa.Integer(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(
            ["production_batch_id"],
            ["production_batches.id"],
            name="fk_production_batch_card_links_batch_id",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["technical_card_id"],
            ["technical_cards.id"],
            name="fk_production_batch_card_links_card_id",
            ondelete="RESTRICT",
        ),
        sa.UniqueConstraint(
            "technical_card_id",
            name="uq_production_batch_card_links_technical_card_id",
        ),
        sa.UniqueConstraint(
            "production_batch_id",
            "technical_card_id",
            name="uq_production_batch_card_links_batch_card",
        ),
    )
    op.create_index(
        "ix_production_batch_card_links_batch_id",
        "production_batch_card_links",
        ["production_batch_id"],
    )
    op.create_index(
        "ix_production_batch_card_links_card_id",
        "production_batch_card_links",
        ["technical_card_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_production_batch_card_links_card_id",
        table_name="production_batch_card_links",
    )
    op.drop_index(
        "ix_production_batch_card_links_batch_id",
        table_name="production_batch_card_links",
    )
    op.drop_table("production_batch_card_links")

    op.drop_index("ix_production_batches_status", table_name="production_batches")
    op.drop_index(
        "ix_production_batches_production_order_id",
        table_name="production_batches",
    )
    op.drop_table("production_batches")

    op.drop_index("ix_production_orders_status", table_name="production_orders")
    op.drop_index(
        "ix_production_orders_sales_order_id",
        table_name="production_orders",
    )
    op.drop_table("production_orders")
