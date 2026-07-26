"""add technical card core tables (header, composition, unit, op-volume, stage results)

Revision ID: k2l3m4n5o678
Revises: j1k2l3m4n567
Roadmap: 9.1.2 / ADR-016
"""

import sqlalchemy as sa
from alembic import op


revision = "k2l3m4n5o678"
down_revision = "j1k2l3m4n567"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "technical_cards",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("sales_order_id", sa.Integer(), nullable=False),
        sa.Column("sales_order_item_id", sa.Integer(), nullable=False),
        sa.Column("number", sa.String(length=80), nullable=False),
        sa.Column("card_seq", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="draft"),
        sa.Column("quantity", sa.Numeric(14, 3), nullable=False),
        sa.Column("nomenclature_id", sa.Integer(), nullable=True),
        sa.Column("nomenclature_name", sa.String(length=255), nullable=True),
        sa.Column("nomenclature_type", sa.String(length=30), nullable=True),
        sa.Column("product_model_id", sa.Integer(), nullable=True),
        sa.Column("product_model_article", sa.String(length=100), nullable=True),
        sa.Column("product_model_name", sa.String(length=255), nullable=True),
        sa.Column("product_model_size_type", sa.String(length=20), nullable=True),
        sa.Column("assembly_variant_id", sa.Integer(), nullable=True),
        sa.Column("assembly_variant_name", sa.String(length=255), nullable=True),
        sa.Column("assembly_variant_total_cost", sa.Numeric(14, 2), nullable=True),
        sa.Column("specification_version_id", sa.Integer(), nullable=True),
        sa.Column("specification_version_label", sa.String(length=255), nullable=True),
        sa.Column("routing_template_id", sa.Integer(), nullable=True),
        sa.Column("routing_template_name", sa.String(length=255), nullable=True),
        sa.Column("current_stage_order", sa.Integer(), nullable=True),
        sa.Column("current_stage_label", sa.String(length=255), nullable=True),
        sa.Column("design_mockup_url", sa.String(length=1000), nullable=True),
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
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["sales_order_item_id"],
            ["sales_order_items.id"],
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["nomenclature_id"],
            ["nomenclatures.id"],
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["product_model_id"],
            ["product_models.id"],
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["assembly_variant_id"],
            ["assembly_variants.id"],
            ondelete="SET NULL",
        ),
        sa.UniqueConstraint("sales_order_item_id", name="uq_technical_cards_sales_order_item_id"),
        sa.UniqueConstraint("sales_order_id", "card_seq", name="uq_technical_cards_order_card_seq"),
        sa.UniqueConstraint("number", name="uq_technical_cards_number"),
        sa.CheckConstraint("card_seq >= 1", name="ck_technical_cards_card_seq"),
        sa.CheckConstraint(
            "status IN ('draft', 'in_progress', 'completed', 'cancelled')",
            name="ck_technical_cards_status",
        ),
        sa.CheckConstraint("quantity > 0", name="ck_technical_cards_quantity_positive"),
        sa.CheckConstraint(
            "product_model_size_type IS NULL OR product_model_size_type IN ('men', 'women', 'kids')",
            name="ck_technical_cards_product_model_size_type",
        ),
        sa.CheckConstraint(
            "assembly_variant_total_cost IS NULL OR assembly_variant_total_cost >= 0",
            name="ck_technical_cards_assembly_variant_total_cost",
        ),
        sa.CheckConstraint(
            "current_stage_order IS NULL OR current_stage_order >= 1",
            name="ck_technical_cards_current_stage_order",
        ),
    )
    op.create_index("ix_technical_cards_sales_order_id", "technical_cards", ["sales_order_id"])
    op.create_index("ix_technical_cards_status", "technical_cards", ["status"])
    op.create_index("ix_technical_cards_updated_at", "technical_cards", ["updated_at"])
    op.create_index("ix_technical_cards_nomenclature_id", "technical_cards", ["nomenclature_id"])
    op.create_index("ix_technical_cards_product_model_id", "technical_cards", ["product_model_id"])
    op.create_index(
        "ix_technical_cards_assembly_variant_id",
        "technical_cards",
        ["assembly_variant_id"],
    )

    op.create_table(
        "technical_card_composition_lines",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("technical_card_id", sa.Integer(), nullable=False),
        sa.Column("sequence", sa.Integer(), nullable=False),
        sa.Column("line_kind", sa.String(length=20), nullable=False, server_default="material"),
        sa.Column("nomenclature_id", sa.Integer(), nullable=True),
        sa.Column("snapshot_name", sa.String(length=255), nullable=False),
        sa.Column("quantity", sa.Numeric(14, 3), nullable=True),
        sa.Column("unit", sa.String(length=30), nullable=True),
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
            ["technical_card_id"],
            ["technical_cards.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["nomenclature_id"],
            ["nomenclatures.id"],
            ondelete="SET NULL",
        ),
        sa.UniqueConstraint(
            "technical_card_id",
            "sequence",
            name="uq_technical_card_composition_lines_card_sequence",
        ),
        sa.CheckConstraint(
            "sequence >= 1",
            name="ck_technical_card_composition_lines_sequence",
        ),
        sa.CheckConstraint(
            "line_kind IN ('material', 'pattern', 'note')",
            name="ck_technical_card_composition_lines_line_kind",
        ),
        sa.CheckConstraint(
            "quantity IS NULL OR quantity >= 0",
            name="ck_technical_card_composition_lines_quantity",
        ),
    )
    op.create_index(
        "ix_technical_card_composition_lines_card_id",
        "technical_card_composition_lines",
        ["technical_card_id"],
    )
    op.create_index(
        "ix_technical_card_composition_lines_nomenclature_id",
        "technical_card_composition_lines",
        ["nomenclature_id"],
    )

    op.create_table(
        "technical_card_unit_lines",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("technical_card_id", sa.Integer(), nullable=False),
        sa.Column("unit_index", sa.Integer(), nullable=False),
        sa.Column("size", sa.String(length=100), nullable=True),
        sa.Column("personalization", sa.String(length=500), nullable=True),
        sa.Column("print_number", sa.String(length=50), nullable=True),
        sa.Column("color", sa.String(length=100), nullable=True),
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
            ["technical_card_id"],
            ["technical_cards.id"],
            ondelete="CASCADE",
        ),
        sa.UniqueConstraint(
            "technical_card_id",
            "unit_index",
            name="uq_technical_card_unit_lines_card_unit_index",
        ),
        sa.CheckConstraint(
            "unit_index >= 1",
            name="ck_technical_card_unit_lines_unit_index",
        ),
    )
    op.create_index(
        "ix_technical_card_unit_lines_card_id",
        "technical_card_unit_lines",
        ["technical_card_id"],
    )

    op.create_table(
        "technical_card_operation_lines",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("technical_card_id", sa.Integer(), nullable=False),
        sa.Column("sequence", sa.Integer(), nullable=False),
        # Soft id until Stage 8.1.3 TechOperation catalog — no FK.
        sa.Column("tech_operation_id", sa.Integer(), nullable=True),
        sa.Column("operation_name", sa.String(length=255), nullable=False),
        sa.Column("volume_unit", sa.String(length=20), nullable=False),
        sa.Column("volume", sa.Numeric(14, 3), nullable=False, server_default="0"),
        sa.Column("stage_order", sa.Integer(), nullable=True),
        sa.Column("stage_label", sa.String(length=255), nullable=True),
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
            ["technical_card_id"],
            ["technical_cards.id"],
            ondelete="CASCADE",
        ),
        sa.UniqueConstraint(
            "technical_card_id",
            "sequence",
            name="uq_technical_card_operation_lines_card_sequence",
        ),
        sa.CheckConstraint(
            "sequence >= 1",
            name="ck_technical_card_operation_lines_sequence",
        ),
        sa.CheckConstraint(
            "volume_unit IN ('linear_meters', 'pieces')",
            name="ck_technical_card_operation_lines_volume_unit",
        ),
        sa.CheckConstraint(
            "volume >= 0",
            name="ck_technical_card_operation_lines_volume",
        ),
        sa.CheckConstraint(
            "stage_order IS NULL OR stage_order >= 1",
            name="ck_technical_card_operation_lines_stage_order",
        ),
    )
    op.create_index(
        "ix_technical_card_operation_lines_card_id",
        "technical_card_operation_lines",
        ["technical_card_id"],
    )
    op.create_index(
        "ix_technical_card_operation_lines_tech_operation_id",
        "technical_card_operation_lines",
        ["tech_operation_id"],
    )

    op.create_table(
        "technical_card_stage_results",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("technical_card_id", sa.Integer(), nullable=False),
        sa.Column("stage_order", sa.Integer(), nullable=False),
        sa.Column("stage_label", sa.String(length=255), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="pending"),
        sa.Column("performer_name", sa.String(length=255), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("scrap_qty", sa.Numeric(14, 3), nullable=True),
        sa.Column("rework_qty", sa.Numeric(14, 3), nullable=True),
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
            ["technical_card_id"],
            ["technical_cards.id"],
            ondelete="CASCADE",
        ),
        sa.UniqueConstraint(
            "technical_card_id",
            "stage_order",
            name="uq_technical_card_stage_results_card_stage_order",
        ),
        sa.CheckConstraint(
            "stage_order >= 1",
            name="ck_technical_card_stage_results_stage_order",
        ),
        sa.CheckConstraint(
            "status IN ('pending', 'in_progress', 'completed', 'skipped')",
            name="ck_technical_card_stage_results_status",
        ),
        sa.CheckConstraint(
            "scrap_qty IS NULL OR scrap_qty >= 0",
            name="ck_technical_card_stage_results_scrap_qty",
        ),
        sa.CheckConstraint(
            "rework_qty IS NULL OR rework_qty >= 0",
            name="ck_technical_card_stage_results_rework_qty",
        ),
    )
    op.create_index(
        "ix_technical_card_stage_results_card_id",
        "technical_card_stage_results",
        ["technical_card_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_technical_card_stage_results_card_id",
        table_name="technical_card_stage_results",
    )
    op.drop_table("technical_card_stage_results")

    op.drop_index(
        "ix_technical_card_operation_lines_tech_operation_id",
        table_name="technical_card_operation_lines",
    )
    op.drop_index(
        "ix_technical_card_operation_lines_card_id",
        table_name="technical_card_operation_lines",
    )
    op.drop_table("technical_card_operation_lines")

    op.drop_index(
        "ix_technical_card_unit_lines_card_id",
        table_name="technical_card_unit_lines",
    )
    op.drop_table("technical_card_unit_lines")

    op.drop_index(
        "ix_technical_card_composition_lines_nomenclature_id",
        table_name="technical_card_composition_lines",
    )
    op.drop_index(
        "ix_technical_card_composition_lines_card_id",
        table_name="technical_card_composition_lines",
    )
    op.drop_table("technical_card_composition_lines")

    op.drop_index("ix_technical_cards_assembly_variant_id", table_name="technical_cards")
    op.drop_index("ix_technical_cards_product_model_id", table_name="technical_cards")
    op.drop_index("ix_technical_cards_nomenclature_id", table_name="technical_cards")
    op.drop_index("ix_technical_cards_updated_at", table_name="technical_cards")
    op.drop_index("ix_technical_cards_status", table_name="technical_cards")
    op.drop_index("ix_technical_cards_sales_order_id", table_name="technical_cards")
    op.drop_table("technical_cards")
