"""Drop legacy materials catalog after nomenclature cutover.

Revision ID: a1b2c3d4e567
Revises: a1b2c3d4e515

Safe guard: refuses to drop while any materials row lacks a matching
nomenclatures.article (case-insensitive). Stock fields are intentionally
not copied (roadmap 4.6.5).
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy import text

revision = "a1b2c3d4e567"
down_revision = "a1b2c3d4e515"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = set(inspector.get_table_names())

    if "materials" in tables:
        orphans = conn.execute(
            text(
                """
                SELECT COUNT(*) FROM materials m
                WHERE NOT EXISTS (
                    SELECT 1 FROM nomenclatures n
                    WHERE lower(n.article) = lower(m.article)
                )
                """
            )
        ).scalar()
        if orphans:
            raise RuntimeError(
                "Cannot drop materials: "
                f"{orphans} row(s) have no matching nomenclature article. "
                "Complete cutover migration z6a7b8c9d012 first."
            )

    if "materials_nomenclature_map" in tables:
        op.drop_table("materials_nomenclature_map")

    if "materials" in tables:
        op.drop_index(op.f("ix_materials_name"), table_name="materials")
        op.drop_index(op.f("ix_materials_article"), table_name="materials")
        op.drop_table("materials")


def downgrade() -> None:
    op.create_table(
        "materials",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("article", sa.String(length=100), nullable=False),
        sa.Column("category", sa.String(length=100), nullable=False),
        sa.Column("unit", sa.String(length=30), nullable=False),
        sa.Column("balance", sa.Numeric(precision=14, scale=3), nullable=False),
        sa.Column(
            "minimum_balance",
            sa.Numeric(precision=14, scale=3),
            nullable=False,
        ),
        sa.Column("warehouse", sa.String(length=255), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_materials_article"),
        "materials",
        ["article"],
        unique=True,
    )
    op.create_index(op.f("ix_materials_name"), "materials", ["name"], unique=False)

    op.create_table(
        "materials_nomenclature_map",
        sa.Column("material_id", sa.Integer(), nullable=False),
        sa.Column("nomenclature_id", sa.Integer(), nullable=False),
        sa.Column(
            "created_nomenclature",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["material_id"],
            ["materials.id"],
            name="fk_materials_nomenclature_map_material_id",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["nomenclature_id"],
            ["nomenclatures.id"],
            name="fk_materials_nomenclature_map_nomenclature_id",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("material_id", name="pk_materials_nomenclature_map"),
        sa.UniqueConstraint(
            "nomenclature_id",
            name="uq_materials_nomenclature_map_nomenclature_id",
        ),
    )
