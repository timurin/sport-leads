"""Drop nomenclatures.article — identity is name + id; garment article lives on ProductModel.

Revision ID: e6f7a8b9c012
Revises: d5e6f7a8b901

Roadmap 4.7.11 / B3. Variant articles and ProductModel.article are unchanged.
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "e6f7a8b9c012"
down_revision = "d5e6f7a8b901"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_constraint("uq_nomenclatures_article", "nomenclatures", type_="unique")
    op.drop_index("ix_nomenclatures_article", table_name="nomenclatures")
    op.drop_column("nomenclatures", "article")


def downgrade() -> None:
    op.add_column(
        "nomenclatures",
        sa.Column("article", sa.String(length=100), nullable=True),
    )
    # Backfill unique placeholders for reverse migration.
    op.execute(
        sa.text(
            """
            UPDATE nomenclatures
            SET article = 'LEGACY-' || id::text
            WHERE article IS NULL
            """
        )
    )
    op.alter_column(
        "nomenclatures",
        "article",
        existing_type=sa.String(length=100),
        nullable=False,
    )
    op.create_index("ix_nomenclatures_article", "nomenclatures", ["article"])
    op.create_unique_constraint(
        "uq_nomenclatures_article",
        "nomenclatures",
        ["article"],
    )
