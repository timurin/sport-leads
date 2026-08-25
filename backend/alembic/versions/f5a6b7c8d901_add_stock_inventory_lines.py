"""Add inventory doc type and stock_inventory_lines (ADR-019 / 12.4.1.2).

Revision ID: f5a6b7c8d901
Revises: e4f5a6b7c890
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "f5a6b7c8d901"
down_revision = "e4f5a6b7c890"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_constraint("ck_stock_documents_doc_type", "stock_documents", type_="check")
    op.create_check_constraint(
        "ck_stock_documents_doc_type",
        "stock_documents",
        "doc_type IN ('receipt', 'issue', 'fg_receipt', 'fg_issue', 'inventory')",
    )
    op.create_table(
        "stock_inventory_lines",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("stock_document_id", sa.Integer(), nullable=False),
        sa.Column("sequence", sa.Integer(), nullable=False),
        sa.Column("nomenclature_id", sa.Integer(), nullable=False),
        sa.Column("book_qty", sa.Numeric(14, 3), nullable=False),
        sa.Column("counted_qty", sa.Numeric(14, 3), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.ForeignKeyConstraint(
            ["stock_document_id"],
            ["stock_documents.id"],
            name="fk_stock_inventory_lines_stock_document_id",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["nomenclature_id"],
            ["nomenclatures.id"],
            name="fk_stock_inventory_lines_nomenclature_id",
            ondelete="RESTRICT",
        ),
        sa.UniqueConstraint(
            "stock_document_id",
            "nomenclature_id",
            name="uq_stock_inventory_lines_document_nomenclature",
        ),
        sa.UniqueConstraint(
            "stock_document_id",
            "sequence",
            name="uq_stock_inventory_lines_document_sequence",
        ),
        sa.CheckConstraint(
            "sequence >= 1",
            name="ck_stock_inventory_lines_sequence",
        ),
        sa.CheckConstraint(
            "counted_qty >= 0",
            name="ck_stock_inventory_lines_counted_qty_nonnegative",
        ),
    )
    op.create_index(
        "ix_stock_inventory_lines_stock_document_id",
        "stock_inventory_lines",
        ["stock_document_id"],
    )
    op.create_index(
        "ix_stock_inventory_lines_nomenclature_id",
        "stock_inventory_lines",
        ["nomenclature_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_stock_inventory_lines_nomenclature_id",
        table_name="stock_inventory_lines",
    )
    op.drop_index(
        "ix_stock_inventory_lines_stock_document_id",
        table_name="stock_inventory_lines",
    )
    op.drop_table("stock_inventory_lines")
    op.execute(
        sa.text("DELETE FROM stock_documents WHERE doc_type = 'inventory'")
    )
    op.drop_constraint("ck_stock_documents_doc_type", "stock_documents", type_="check")
    op.create_check_constraint(
        "ck_stock_documents_doc_type",
        "stock_documents",
        "doc_type IN ('receipt', 'issue', 'fg_receipt', 'fg_issue')",
    )
