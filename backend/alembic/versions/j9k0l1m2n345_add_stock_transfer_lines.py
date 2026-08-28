"""Add transfer doc type, destination warehouse, transfer lines (ADR-019 / 12.5.1.2).

Revision ID: j9k0l1m2n345
Revises: i8j9k0l1m234
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "j9k0l1m2n345"
down_revision = "i8j9k0l1m234"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "stock_documents",
        sa.Column("destination_warehouse_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_stock_documents_destination_warehouse_id",
        "stock_documents",
        "warehouses",
        ["destination_warehouse_id"],
        ["id"],
        ondelete="RESTRICT",
    )
    op.create_index(
        "ix_stock_documents_destination_warehouse_id",
        "stock_documents",
        ["destination_warehouse_id"],
    )
    op.drop_constraint("ck_stock_documents_doc_type", "stock_documents", type_="check")
    op.create_check_constraint(
        "ck_stock_documents_doc_type",
        "stock_documents",
        "doc_type IN ('receipt', 'issue', 'fg_receipt', 'fg_issue', 'inventory', 'transfer')",
    )
    op.create_check_constraint(
        "ck_stock_documents_transfer_destination",
        "stock_documents",
        "("
        "doc_type <> 'transfer' AND destination_warehouse_id IS NULL"
        ") OR ("
        "doc_type = 'transfer' AND destination_warehouse_id IS NOT NULL "
        "AND destination_warehouse_id <> warehouse_id"
        ")",
    )
    op.create_table(
        "stock_transfer_lines",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("stock_document_id", sa.Integer(), nullable=False),
        sa.Column("sequence", sa.Integer(), nullable=False),
        sa.Column("nomenclature_id", sa.Integer(), nullable=False),
        sa.Column("quantity", sa.Numeric(14, 3), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.ForeignKeyConstraint(
            ["stock_document_id"],
            ["stock_documents.id"],
            name="fk_stock_transfer_lines_stock_document_id",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["nomenclature_id"],
            ["nomenclatures.id"],
            name="fk_stock_transfer_lines_nomenclature_id",
            ondelete="RESTRICT",
        ),
        sa.UniqueConstraint(
            "stock_document_id",
            "nomenclature_id",
            name="uq_stock_transfer_lines_document_nomenclature",
        ),
        sa.UniqueConstraint(
            "stock_document_id",
            "sequence",
            name="uq_stock_transfer_lines_document_sequence",
        ),
        sa.CheckConstraint(
            "sequence >= 1",
            name="ck_stock_transfer_lines_sequence",
        ),
        sa.CheckConstraint(
            "quantity > 0",
            name="ck_stock_transfer_lines_quantity_positive",
        ),
    )
    op.create_index(
        "ix_stock_transfer_lines_stock_document_id",
        "stock_transfer_lines",
        ["stock_document_id"],
    )
    op.create_index(
        "ix_stock_transfer_lines_nomenclature_id",
        "stock_transfer_lines",
        ["nomenclature_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_stock_transfer_lines_nomenclature_id",
        table_name="stock_transfer_lines",
    )
    op.drop_index(
        "ix_stock_transfer_lines_stock_document_id",
        table_name="stock_transfer_lines",
    )
    op.drop_table("stock_transfer_lines")
    op.execute(sa.text("DELETE FROM stock_documents WHERE doc_type = 'transfer'"))
    op.drop_constraint(
        "ck_stock_documents_transfer_destination",
        "stock_documents",
        type_="check",
    )
    op.drop_constraint("ck_stock_documents_doc_type", "stock_documents", type_="check")
    op.create_check_constraint(
        "ck_stock_documents_doc_type",
        "stock_documents",
        "doc_type IN ('receipt', 'issue', 'fg_receipt', 'fg_issue', 'inventory')",
    )
    op.drop_index(
        "ix_stock_documents_destination_warehouse_id",
        table_name="stock_documents",
    )
    op.drop_constraint(
        "fk_stock_documents_destination_warehouse_id",
        "stock_documents",
        type_="foreignkey",
    )
    op.drop_column("stock_documents", "destination_warehouse_id")
