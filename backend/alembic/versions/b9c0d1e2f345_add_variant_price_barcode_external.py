"""Add variant price, barcode, external_code (roadmap 4.4.6.1).

Revision ID: b9c0d1e2f345
Revises: a8b9c0d1e234
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op


revision = "b9c0d1e2f345"
down_revision = "a8b9c0d1e234"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "nomenclature_variants",
        sa.Column("price", sa.Numeric(14, 2), nullable=True),
    )
    op.add_column(
        "nomenclature_variants",
        sa.Column("barcode", sa.String(length=64), nullable=True),
    )
    op.add_column(
        "nomenclature_variants",
        sa.Column("external_code", sa.String(length=100), nullable=True),
    )
    op.create_check_constraint(
        "ck_nomenclature_variants_price_non_negative",
        "nomenclature_variants",
        "price IS NULL OR price >= 0",
    )
    op.create_index(
        "ix_nomenclature_variants_barcode",
        "nomenclature_variants",
        ["barcode"],
        unique=True,
    )
    op.create_index(
        "ix_nomenclature_variants_external_code",
        "nomenclature_variants",
        ["external_code"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_nomenclature_variants_external_code",
        table_name="nomenclature_variants",
    )
    op.drop_index(
        "ix_nomenclature_variants_barcode",
        table_name="nomenclature_variants",
    )
    op.drop_constraint(
        "ck_nomenclature_variants_price_non_negative",
        "nomenclature_variants",
        type_="check",
    )
    op.drop_column("nomenclature_variants", "external_code")
    op.drop_column("nomenclature_variants", "barcode")
    op.drop_column("nomenclature_variants", "price")
