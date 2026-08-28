"""add detailing catalog and product model material lines

Revision ID: s8t9u0v1w234
Revises: r7s8t9u0v123
Create Date: 2026-08-29

Stage 26.13 — Detailing + model Materials BOM (ADR-035).
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "s8t9u0v1w234"
down_revision: Union[str, Sequence[str], None] = "r7s8t9u0v123"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "detailing_items",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column(
            "applicability_product_type_id",
            sa.Integer(),
            sa.ForeignKey("product_types.id", ondelete="RESTRICT"),
            nullable=False,
        ),
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
        sa.UniqueConstraint("name", name="uq_detailing_items_name"),
    )
    op.create_index(
        "ix_detailing_items_name",
        "detailing_items",
        ["name"],
    )
    op.create_index(
        "ix_detailing_items_applicability_product_type_id",
        "detailing_items",
        ["applicability_product_type_id"],
    )

    op.create_table(
        "product_model_material_lines",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "product_model_id",
            sa.Integer(),
            sa.ForeignKey("product_models.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("kind", sa.String(length=32), nullable=False),
        sa.Column(
            "nomenclature_id",
            sa.Integer(),
            sa.ForeignKey("nomenclatures.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("planned_qty", sa.Numeric(14, 3), nullable=False),
        sa.Column("sequence", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "fabric_stage_code",
            sa.String(length=32),
            nullable=True,
        ),
        sa.Column(
            "type_option_id",
            sa.Integer(),
            sa.ForeignKey("characteristic_options.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "color_option_id",
            sa.Integer(),
            sa.ForeignKey("characteristic_options.id", ondelete="SET NULL"),
            nullable=True,
        ),
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
        sa.CheckConstraint(
            "kind IN ('print', 'fabric', 'cutting', 'hardware', 'packaging')",
            name="ck_product_model_material_lines_kind",
        ),
        sa.CheckConstraint(
            "planned_qty > 0",
            name="ck_product_model_material_lines_planned_qty_positive",
        ),
        sa.CheckConstraint(
            "sequence >= 0",
            name="ck_product_model_material_lines_sequence_nonnegative",
        ),
        sa.CheckConstraint(
            "(kind <> 'fabric' AND fabric_stage_code IS NULL) OR "
            "(kind = 'fabric' AND fabric_stage_code IN ('print', 'cutting'))",
            name="ck_product_model_material_lines_fabric_stage",
        ),
    )
    op.create_index(
        "ix_product_model_material_lines_product_model_id",
        "product_model_material_lines",
        ["product_model_id"],
    )
    op.create_index(
        "ix_product_model_material_lines_kind",
        "product_model_material_lines",
        ["kind"],
    )

    op.create_table(
        "product_model_material_line_detailings",
        sa.Column(
            "material_line_id",
            sa.Integer(),
            sa.ForeignKey("product_model_material_lines.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "detailing_item_id",
            sa.Integer(),
            sa.ForeignKey("detailing_items.id", ondelete="RESTRICT"),
            primary_key=True,
        ),
    )

    # Seed hardware_type characteristic if missing (type options for фурнитура).
    op.execute(
        sa.text(
            """
            INSERT INTO characteristic_definitions (
              code, name, kind, is_active, is_system, is_visible,
              is_searchable, is_filterable, is_variant_dimension,
              created_at, updated_at
            )
            SELECT
              'hardware_type', 'Тип фурнитуры', 'LIST', true, true, true,
              false, true, false, now(), now()
            WHERE NOT EXISTS (
              SELECT 1 FROM characteristic_definitions WHERE code = 'hardware_type'
            )
            """
        )
    )
    op.execute(
        sa.text(
            """
            INSERT INTO characteristic_options (
              characteristic_id, code, label, hex_value, sort_order, is_active,
              created_at, updated_at
            )
            SELECT d.id, v.code, v.label, NULL, v.sort_order, true, now(), now()
            FROM characteristic_definitions d
            CROSS JOIN (
              VALUES
                ('button', 'Пуговица', 10),
                ('zipper', 'Молния', 20),
                ('snap', 'Кнопка', 30),
                ('elastic', 'Резинка', 40),
                ('other', 'Прочее', 90)
            ) AS v(code, label, sort_order)
            WHERE d.code = 'hardware_type'
              AND NOT EXISTS (
                SELECT 1 FROM characteristic_options o
                WHERE o.characteristic_id = d.id AND o.code = v.code
              )
            """
        )
    )


def downgrade() -> None:
    op.drop_table("product_model_material_line_detailings")
    op.drop_index(
        "ix_product_model_material_lines_kind",
        table_name="product_model_material_lines",
    )
    op.drop_index(
        "ix_product_model_material_lines_product_model_id",
        table_name="product_model_material_lines",
    )
    op.drop_table("product_model_material_lines")
    op.drop_index(
        "ix_detailing_items_applicability_product_type_id",
        table_name="detailing_items",
    )
    op.drop_index("ix_detailing_items_name", table_name="detailing_items")
    op.drop_table("detailing_items")
