"""Extend stock_documents.doc_type for FG receipt/issue (ADR-019 / 12.3.1).

Revision ID: r5s6t7u8v901
Revises: q4r5s6t7u890
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "r5s6t7u8v901"
down_revision = "q4r5s6t7u890"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_constraint("ck_stock_documents_doc_type", "stock_documents", type_="check")
    op.create_check_constraint(
        "ck_stock_documents_doc_type",
        "stock_documents",
        "doc_type IN ('receipt', 'issue', 'fg_receipt', 'fg_issue')",
    )


def downgrade() -> None:
    op.execute(
        sa.text(
            "UPDATE stock_documents SET doc_type = 'receipt' WHERE doc_type = 'fg_receipt'"
        )
    )
    op.execute(
        sa.text(
            "UPDATE stock_documents SET doc_type = 'issue' WHERE doc_type = 'fg_issue'"
        )
    )
    op.drop_constraint("ck_stock_documents_doc_type", "stock_documents", type_="check")
    op.create_check_constraint(
        "ck_stock_documents_doc_type",
        "stock_documents",
        "doc_type IN ('receipt', 'issue')",
    )
