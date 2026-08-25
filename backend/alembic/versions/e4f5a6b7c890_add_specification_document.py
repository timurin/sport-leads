"""Add specification document tables and TC version FK (7.1.2 / ADR-031).

Revision ID: e4f5a6b7c890
Revises: d3e4f5a6b789
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "e4f5a6b7c890"
down_revision = "d3e4f5a6b789"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "specifications",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("production_batch_id", sa.Integer(), nullable=False),
        sa.Column("number", sa.String(length=120), nullable=False),
        sa.Column("sales_order_id", sa.Integer(), nullable=False),
        sa.Column("production_order_id", sa.Integer(), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.ForeignKeyConstraint(
            ["production_batch_id"],
            ["production_batches.id"],
            name="fk_specifications_production_batch_id",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["sales_order_id"],
            ["sales_orders.id"],
            name="fk_specifications_sales_order_id",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["production_order_id"],
            ["production_orders.id"],
            name="fk_specifications_production_order_id",
            ondelete="RESTRICT",
        ),
        sa.UniqueConstraint(
            "production_batch_id",
            name="uq_specifications_production_batch_id",
        ),
        sa.UniqueConstraint("number", name="uq_specifications_number"),
    )
    op.create_index(
        "ix_specifications_sales_order_id",
        "specifications",
        ["sales_order_id"],
    )
    op.create_index(
        "ix_specifications_production_order_id",
        "specifications",
        ["production_order_id"],
    )

    op.create_table(
        "specification_versions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("specification_id", sa.Integer(), nullable=False),
        sa.Column("version_no", sa.Integer(), nullable=False),
        sa.Column(
            "status",
            sa.String(length=20),
            nullable=False,
            server_default="draft",
        ),
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cancelled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.ForeignKeyConstraint(
            ["specification_id"],
            ["specifications.id"],
            name="fk_specification_versions_specification_id",
            ondelete="CASCADE",
        ),
        sa.UniqueConstraint(
            "specification_id",
            "version_no",
            name="uq_specification_versions_header_version_no",
        ),
    )
    op.create_index(
        "ix_specification_versions_specification_id",
        "specification_versions",
        ["specification_id"],
    )
    op.create_index(
        "ix_specification_versions_status",
        "specification_versions",
        ["status"],
    )
    op.create_index(
        "uq_specification_versions_one_draft",
        "specification_versions",
        ["specification_id"],
        unique=True,
        postgresql_where=sa.text("status = 'draft'"),
    )
    op.create_index(
        "uq_specification_versions_one_approved",
        "specification_versions",
        ["specification_id"],
        unique=True,
        postgresql_where=sa.text("status = 'approved'"),
    )

    op.create_table(
        "specification_product_lines",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("specification_version_id", sa.Integer(), nullable=False),
        sa.Column("sequence", sa.Integer(), nullable=False),
        sa.Column("technical_card_id", sa.Integer(), nullable=False),
        sa.Column("sales_order_item_id", sa.Integer(), nullable=True),
        sa.Column("nomenclature_id", sa.Integer(), nullable=True),
        sa.Column("nomenclature_name", sa.String(length=255), nullable=True),
        sa.Column("nomenclature_type", sa.String(length=30), nullable=True),
        sa.Column("product_model_id", sa.Integer(), nullable=True),
        sa.Column("product_model_article", sa.String(length=100), nullable=True),
        sa.Column("product_model_name", sa.String(length=255), nullable=True),
        sa.Column("assembly_variant_id", sa.Integer(), nullable=True),
        sa.Column("assembly_variant_name", sa.String(length=255), nullable=True),
        sa.Column("quantity", sa.Numeric(14, 3), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.ForeignKeyConstraint(
            ["specification_version_id"],
            ["specification_versions.id"],
            name="fk_specification_product_lines_version_id",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["technical_card_id"],
            ["technical_cards.id"],
            name="fk_specification_product_lines_technical_card_id",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["sales_order_item_id"],
            ["sales_order_items.id"],
            name="fk_specification_product_lines_sales_order_item_id",
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["nomenclature_id"],
            ["nomenclatures.id"],
            name="fk_specification_product_lines_nomenclature_id",
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["product_model_id"],
            ["product_models.id"],
            name="fk_specification_product_lines_product_model_id",
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["assembly_variant_id"],
            ["assembly_variants.id"],
            name="fk_specification_product_lines_assembly_variant_id",
            ondelete="SET NULL",
        ),
        sa.UniqueConstraint(
            "specification_version_id",
            "sequence",
            name="uq_specification_product_lines_version_sequence",
        ),
    )
    op.create_index(
        "ix_specification_product_lines_version_id",
        "specification_product_lines",
        ["specification_version_id"],
    )
    op.create_index(
        "ix_specification_product_lines_technical_card_id",
        "specification_product_lines",
        ["technical_card_id"],
    )

    op.create_table(
        "specification_material_lines",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("specification_version_id", sa.Integer(), nullable=False),
        sa.Column("sequence", sa.Integer(), nullable=False),
        sa.Column("nomenclature_id", sa.Integer(), nullable=True),
        sa.Column("snapshot_name", sa.String(length=255), nullable=False),
        sa.Column("unit", sa.String(length=30), nullable=True),
        sa.Column("production_stage_id", sa.Integer(), nullable=True),
        sa.Column("planned_qty", sa.Numeric(14, 3), nullable=True),
        sa.Column("fact_qty", sa.Numeric(14, 3), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.ForeignKeyConstraint(
            ["specification_version_id"],
            ["specification_versions.id"],
            name="fk_specification_material_lines_version_id",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["nomenclature_id"],
            ["nomenclatures.id"],
            name="fk_specification_material_lines_nomenclature_id",
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["production_stage_id"],
            ["production_stages.id"],
            name="fk_specification_material_lines_production_stage_id",
            ondelete="SET NULL",
        ),
        sa.UniqueConstraint(
            "specification_version_id",
            "sequence",
            name="uq_specification_material_lines_version_sequence",
        ),
    )
    op.create_index(
        "ix_specification_material_lines_version_id",
        "specification_material_lines",
        ["specification_version_id"],
    )
    op.create_index(
        "ix_specification_material_lines_nomenclature_id",
        "specification_material_lines",
        ["nomenclature_id"],
    )
    op.create_index(
        "ix_specification_material_lines_production_stage_id",
        "specification_material_lines",
        ["production_stage_id"],
    )

    op.create_table(
        "specification_operation_lines",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("specification_version_id", sa.Integer(), nullable=False),
        sa.Column("sequence", sa.Integer(), nullable=False),
        sa.Column("source_kind", sa.String(length=20), nullable=False),
        sa.Column("technical_card_id", sa.Integer(), nullable=True),
        sa.Column("tech_operation_id", sa.Integer(), nullable=True),
        sa.Column("sewing_operation_id", sa.Integer(), nullable=True),
        sa.Column("operation_name", sa.String(length=255), nullable=False),
        sa.Column("volume_unit", sa.String(length=20), nullable=False),
        sa.Column("planned_volume", sa.Numeric(14, 3), nullable=False),
        sa.Column("fact_volume", sa.Numeric(14, 3), nullable=True),
        sa.Column("duration_seconds", sa.Integer(), nullable=True),
        sa.Column("performer_name", sa.String(length=255), nullable=True),
        sa.Column("production_stage_id", sa.Integer(), nullable=True),
        sa.Column("stage_label", sa.String(length=255), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.ForeignKeyConstraint(
            ["specification_version_id"],
            ["specification_versions.id"],
            name="fk_specification_operation_lines_version_id",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["technical_card_id"],
            ["technical_cards.id"],
            name="fk_specification_operation_lines_technical_card_id",
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["sewing_operation_id"],
            ["sewing_operations.id"],
            name="fk_specification_operation_lines_sewing_operation_id",
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["production_stage_id"],
            ["production_stages.id"],
            name="fk_specification_operation_lines_production_stage_id",
            ondelete="SET NULL",
        ),
        sa.UniqueConstraint(
            "specification_version_id",
            "sequence",
            name="uq_specification_operation_lines_version_sequence",
        ),
    )
    op.create_index(
        "ix_specification_operation_lines_version_id",
        "specification_operation_lines",
        ["specification_version_id"],
    )
    op.create_index(
        "ix_specification_operation_lines_technical_card_id",
        "specification_operation_lines",
        ["technical_card_id"],
    )

    op.create_foreign_key(
        "fk_technical_cards_specification_version_id",
        "technical_cards",
        "specification_versions",
        ["specification_version_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_technical_cards_specification_version_id",
        "technical_cards",
        type_="foreignkey",
    )
    op.drop_index(
        "ix_specification_operation_lines_technical_card_id",
        table_name="specification_operation_lines",
    )
    op.drop_index(
        "ix_specification_operation_lines_version_id",
        table_name="specification_operation_lines",
    )
    op.drop_table("specification_operation_lines")
    op.drop_index(
        "ix_specification_material_lines_production_stage_id",
        table_name="specification_material_lines",
    )
    op.drop_index(
        "ix_specification_material_lines_nomenclature_id",
        table_name="specification_material_lines",
    )
    op.drop_index(
        "ix_specification_material_lines_version_id",
        table_name="specification_material_lines",
    )
    op.drop_table("specification_material_lines")
    op.drop_index(
        "ix_specification_product_lines_technical_card_id",
        table_name="specification_product_lines",
    )
    op.drop_index(
        "ix_specification_product_lines_version_id",
        table_name="specification_product_lines",
    )
    op.drop_table("specification_product_lines")
    op.drop_index(
        "uq_specification_versions_one_approved",
        table_name="specification_versions",
    )
    op.drop_index(
        "uq_specification_versions_one_draft",
        table_name="specification_versions",
    )
    op.drop_index(
        "ix_specification_versions_status",
        table_name="specification_versions",
    )
    op.drop_index(
        "ix_specification_versions_specification_id",
        table_name="specification_versions",
    )
    op.drop_table("specification_versions")
    op.drop_index(
        "ix_specifications_production_order_id",
        table_name="specifications",
    )
    op.drop_index("ix_specifications_sales_order_id", table_name="specifications")
    op.drop_table("specifications")
