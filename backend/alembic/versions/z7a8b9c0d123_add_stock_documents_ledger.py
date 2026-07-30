"""Add stock_documents and stock_ledger_lines (Warehouse already in y6).

Revision ID: z7a8b9c0d123
Revises: y6z7a8b9c012
Roadmap: 12.2.1 / ADR-019
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op


revision = "z7a8b9c0d123"
down_revision = "y6z7a8b9c012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "stock_documents",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("number", sa.String(length=80), nullable=False),
        sa.Column("doc_type", sa.String(length=20), nullable=False),
        sa.Column(
            "status",
            sa.String(length=20),
            nullable=False,
            server_default="draft",
        ),
        sa.Column("warehouse_id", sa.Integer(), nullable=False),
        sa.Column("posted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("technical_card_id", sa.Integer(), nullable=True),
        sa.Column("sales_order_id", sa.Integer(), nullable=True),
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
            ["warehouse_id"],
            ["warehouses.id"],
            name="fk_stock_documents_warehouse_id",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["technical_card_id"],
            ["technical_cards.id"],
            name="fk_stock_documents_technical_card_id",
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["sales_order_id"],
            ["sales_orders.id"],
            name="fk_stock_documents_sales_order_id",
            ondelete="SET NULL",
        ),
        sa.UniqueConstraint("number", name="uq_stock_documents_number"),
        sa.CheckConstraint(
            "doc_type IN ('receipt', 'issue')",
            name="ck_stock_documents_doc_type",
        ),
        sa.CheckConstraint(
            "status IN ('draft', 'posted', 'cancelled')",
            name="ck_stock_documents_status",
        ),
    )
    op.create_index(
        "ix_stock_documents_warehouse_id",
        "stock_documents",
        ["warehouse_id"],
    )
    op.create_index("ix_stock_documents_status", "stock_documents", ["status"])
    op.create_index(
        "ix_stock_documents_doc_type", "stock_documents", ["doc_type"]
    )
    op.create_index(
        "ix_stock_documents_posted_at", "stock_documents", ["posted_at"]
    )
    op.create_index(
        "ix_stock_documents_technical_card_id",
        "stock_documents",
        ["technical_card_id"],
    )
    op.create_index(
        "ix_stock_documents_sales_order_id",
        "stock_documents",
        ["sales_order_id"],
    )

    op.create_table(
        "stock_ledger_lines",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("stock_document_id", sa.Integer(), nullable=False),
        sa.Column("line_no", sa.Integer(), nullable=False),
        sa.Column("warehouse_id", sa.Integer(), nullable=False),
        sa.Column("nomenclature_id", sa.Integer(), nullable=False),
        sa.Column("quantity", sa.Numeric(14, 3), nullable=False),
        sa.Column("posted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("technical_card_id", sa.Integer(), nullable=True),
        sa.Column("sales_order_id", sa.Integer(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(
            ["stock_document_id"],
            ["stock_documents.id"],
            name="fk_stock_ledger_lines_stock_document_id",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["warehouse_id"],
            ["warehouses.id"],
            name="fk_stock_ledger_lines_warehouse_id",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["nomenclature_id"],
            ["nomenclatures.id"],
            name="fk_stock_ledger_lines_nomenclature_id",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["technical_card_id"],
            ["technical_cards.id"],
            name="fk_stock_ledger_lines_technical_card_id",
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["sales_order_id"],
            ["sales_orders.id"],
            name="fk_stock_ledger_lines_sales_order_id",
            ondelete="SET NULL",
        ),
        sa.UniqueConstraint(
            "stock_document_id",
            "line_no",
            name="uq_stock_ledger_lines_document_line_no",
        ),
        sa.CheckConstraint(
            "quantity != 0",
            name="ck_stock_ledger_lines_quantity_nonzero",
        ),
        sa.CheckConstraint(
            "line_no >= 1",
            name="ck_stock_ledger_lines_line_no",
        ),
    )
    op.create_index(
        "ix_stock_ledger_lines_stock_document_id",
        "stock_ledger_lines",
        ["stock_document_id"],
    )
    op.create_index(
        "ix_stock_ledger_lines_warehouse_nomenclature",
        "stock_ledger_lines",
        ["warehouse_id", "nomenclature_id"],
    )
    op.create_index(
        "ix_stock_ledger_lines_nomenclature_id",
        "stock_ledger_lines",
        ["nomenclature_id"],
    )
    op.create_index(
        "ix_stock_ledger_lines_posted_at",
        "stock_ledger_lines",
        ["posted_at"],
    )
    op.create_index(
        "ix_stock_ledger_lines_technical_card_id",
        "stock_ledger_lines",
        ["technical_card_id"],
    )
    op.create_index(
        "ix_stock_ledger_lines_sales_order_id",
        "stock_ledger_lines",
        ["sales_order_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_stock_ledger_lines_sales_order_id", table_name="stock_ledger_lines"
    )
    op.drop_index(
        "ix_stock_ledger_lines_technical_card_id",
        table_name="stock_ledger_lines",
    )
    op.drop_index(
        "ix_stock_ledger_lines_posted_at", table_name="stock_ledger_lines"
    )
    op.drop_index(
        "ix_stock_ledger_lines_nomenclature_id",
        table_name="stock_ledger_lines",
    )
    op.drop_index(
        "ix_stock_ledger_lines_warehouse_nomenclature",
        table_name="stock_ledger_lines",
    )
    op.drop_index(
        "ix_stock_ledger_lines_stock_document_id",
        table_name="stock_ledger_lines",
    )
    op.drop_table("stock_ledger_lines")

    op.drop_index(
        "ix_stock_documents_sales_order_id", table_name="stock_documents"
    )
    op.drop_index(
        "ix_stock_documents_technical_card_id", table_name="stock_documents"
    )
    op.drop_index("ix_stock_documents_posted_at", table_name="stock_documents")
    op.drop_index("ix_stock_documents_doc_type", table_name="stock_documents")
    op.drop_index("ix_stock_documents_status", table_name="stock_documents")
    op.drop_index(
        "ix_stock_documents_warehouse_id", table_name="stock_documents"
    )
    op.drop_table("stock_documents")
