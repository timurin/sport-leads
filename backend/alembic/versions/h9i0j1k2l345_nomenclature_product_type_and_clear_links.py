"""add nomenclature.product_type_id; clear available-model links

Revision ID: h9i0j1k2l345
Revises: g8h9i0j1k234
"""

import sqlalchemy as sa
from alembic import op


revision = "h9i0j1k2l345"
down_revision = "g8h9i0j1k234"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Owner-approved reset: re-select models after Вид изделия binding.
    op.execute(sa.text("DELETE FROM nomenclature_product_models"))

    op.add_column(
        "nomenclatures",
        sa.Column("product_type_id", sa.Integer(), nullable=True),
    )
    op.create_index(
        "ix_nomenclatures_product_type_id",
        "nomenclatures",
        ["product_type_id"],
    )
    op.create_foreign_key(
        "fk_nomenclatures_product_type_id",
        "nomenclatures",
        "product_types",
        ["product_type_id"],
        ["id"],
        ondelete="RESTRICT",
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_nomenclatures_product_type_id",
        "nomenclatures",
        type_="foreignkey",
    )
    op.drop_index("ix_nomenclatures_product_type_id", table_name="nomenclatures")
    op.drop_column("nomenclatures", "product_type_id")
