"""Migrate materials rows into nomenclatures as type MATERIAL.

Revision ID: z6a7b8c9d012
Revises: y5z6a7b8c901
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy import text

revision = "z6a7b8c9d012"
down_revision = "y5z6a7b8c901"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "materials_nomenclature_map",
        sa.Column("material_id", sa.Integer(), nullable=False),
        sa.Column("nomenclature_id", sa.Integer(), nullable=False),
        sa.Column("created_nomenclature", sa.Boolean(), nullable=False, server_default=sa.text("false")),
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

    conn = op.get_bind()
    materials = conn.execute(
        text(
            """
            SELECT id, name, article, category, unit, description, is_active
            FROM materials
            ORDER BY id
            """
        )
    ).mappings().all()

    for row in materials:
        article = (row["article"] or "").strip()
        if not article:
            continue

        existing = conn.execute(
            text(
                """
                SELECT id FROM nomenclatures
                WHERE lower(article) = lower(:article)
                LIMIT 1
                """
            ),
            {"article": article},
        ).first()

        if existing is not None:
            nomenclature_id = existing[0]
            created = False
        else:
            unit_raw = (row["unit"] or "шт").strip() or "шт"
            storage_unit_id = conn.execute(
                text(
                    """
                    SELECT id FROM units_of_measure
                    WHERE lower(symbol) = lower(:unit)
                       OR lower(code) = lower(:unit)
                    ORDER BY id
                    LIMIT 1
                    """
                ),
                {"unit": unit_raw},
            ).scalar()

            result = conn.execute(
                text(
                    """
                    INSERT INTO nomenclatures (
                        article,
                        name,
                        short_name,
                        description,
                        category,
                        category_id,
                        nomenclature_type,
                        unit,
                        storage_unit_id,
                        base_price,
                        currency,
                        is_active
                    ) VALUES (
                        :article,
                        :name,
                        NULL,
                        :description,
                        :category,
                        NULL,
                        'MATERIAL',
                        :unit,
                        :storage_unit_id,
                        0,
                        'RUB',
                        :is_active
                    )
                    RETURNING id
                    """
                ),
                {
                    "article": article,
                    "name": row["name"],
                    "description": row["description"],
                    "category": row["category"] or "Материалы",
                    "unit": unit_raw,
                    "storage_unit_id": storage_unit_id,
                    "is_active": bool(row["is_active"]),
                },
            )
            nomenclature_id = result.scalar_one()
            created = True

        conn.execute(
            text(
                """
                INSERT INTO materials_nomenclature_map (
                    material_id, nomenclature_id, created_nomenclature
                ) VALUES (
                    :material_id, :nomenclature_id, :created
                )
                ON CONFLICT (material_id) DO NOTHING
                """
            ),
            {
                "material_id": row["id"],
                "nomenclature_id": nomenclature_id,
                "created": created,
            },
        )


def downgrade() -> None:
    conn = op.get_bind()
    created_ids = [
        row[0]
        for row in conn.execute(
            text(
                """
                SELECT nomenclature_id
                FROM materials_nomenclature_map
                WHERE created_nomenclature IS TRUE
                """
            )
        ).all()
    ]

    if created_ids:
        # Clear optional FKs that would block delete (SET NULL style links).
        update_stmt = text(
            "UPDATE sales_order_items SET nomenclature_id = NULL "
            "WHERE nomenclature_id IN :ids"
        ).bindparams(sa.bindparam("ids", expanding=True))
        conn.execute(update_stmt, {"ids": created_ids})

        # Drop dependent whitelist / media links if present (CASCADE may already cover).
        for table in (
            "nomenclature_product_models",
            "nomenclature_media",
            "nomenclature_variants",
            "nomenclature_characteristics",
            "nomenclature_field_values",
        ):
            exists = conn.execute(
                text("SELECT to_regclass(:name)"),
                {"name": table},
            ).scalar()
            if exists:
                delete_child = text(
                    f"DELETE FROM {table} WHERE nomenclature_id IN :ids"
                ).bindparams(sa.bindparam("ids", expanding=True))
                conn.execute(delete_child, {"ids": created_ids})

        delete_stmt = text(
            "DELETE FROM nomenclatures WHERE id IN :ids"
        ).bindparams(sa.bindparam("ids", expanding=True))
        conn.execute(delete_stmt, {"ids": created_ids})

    op.drop_table("materials_nomenclature_map")
