"""detailing applicability multi product types

Revision ID: t9u0v1w2x345
Revises: s8t9u0v1w234
Create Date: 2026-08-29

Stage 26.13 — Detailing applicability = many product types (owner ask).
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "t9u0v1w2x345"
down_revision: Union[str, Sequence[str], None] = "s8t9u0v1w234"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "detailing_item_product_types",
        sa.Column(
            "detailing_item_id",
            sa.Integer(),
            sa.ForeignKey("detailing_items.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "product_type_id",
            sa.Integer(),
            sa.ForeignKey("product_types.id", ondelete="RESTRICT"),
            primary_key=True,
        ),
    )
    op.create_index(
        "ix_detailing_item_product_types_product_type_id",
        "detailing_item_product_types",
        ["product_type_id"],
    )
    op.execute(
        sa.text(
            """
            INSERT INTO detailing_item_product_types (detailing_item_id, product_type_id)
            SELECT id, applicability_product_type_id
            FROM detailing_items
            WHERE applicability_product_type_id IS NOT NULL
            """
        )
    )
    op.drop_index(
        "ix_detailing_items_applicability_product_type_id",
        table_name="detailing_items",
    )
    op.drop_constraint(
        "detailing_items_applicability_product_type_id_fkey",
        "detailing_items",
        type_="foreignkey",
    )
    op.drop_column("detailing_items", "applicability_product_type_id")


def downgrade() -> None:
    op.add_column(
        "detailing_items",
        sa.Column(
            "applicability_product_type_id",
            sa.Integer(),
            nullable=True,
        ),
    )
    op.execute(
        sa.text(
            """
            UPDATE detailing_items AS d
            SET applicability_product_type_id = (
                SELECT MIN(m.product_type_id)
                FROM detailing_item_product_types AS m
                WHERE m.detailing_item_id = d.id
            )
            """
        )
    )
    op.execute(
        sa.text(
            """
            DELETE FROM detailing_items
            WHERE applicability_product_type_id IS NULL
            """
        )
    )
    op.alter_column(
        "detailing_items",
        "applicability_product_type_id",
        nullable=False,
    )
    op.create_foreign_key(
        "detailing_items_applicability_product_type_id_fkey",
        "detailing_items",
        "product_types",
        ["applicability_product_type_id"],
        ["id"],
        ondelete="RESTRICT",
    )
    op.create_index(
        "ix_detailing_items_applicability_product_type_id",
        "detailing_items",
        ["applicability_product_type_id"],
    )
    op.drop_index(
        "ix_detailing_item_product_types_product_type_id",
        table_name="detailing_item_product_types",
    )
    op.drop_table("detailing_item_product_types")
