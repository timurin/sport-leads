"""Add tech-card QR token, unit-line location, and print QR block (25.1).

Revision ID: d3e4f5a6b789
Revises: c2d3e4f5a678
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "d3e4f5a6b789"
down_revision = "c2d3e4f5a678"
branch_labels = None
depends_on = None

_HEAD_OLD = """    <div class="pf-head">
      <div>
        <h1 class="pf-title">Техкарта</h1>
        <div class="pf-text">{{ document_number }}</div>
      </div>
      <div class="pf-text">{{ header.status_label }}</div>
    </div>"""

_HEAD_NEW = """    <div class="pf-head">
      <div>
        <h1 class="pf-title">Техкарта</h1>
        <div class="pf-text">{{ document_number }}</div>
      </div>
      <div class="pf-qr">{{ html.qr_block }}</div>
      <div class="pf-text">{{ header.status_label }}</div>
    </div>"""

_CSS_OLD = (
    ".pf-head { display: flex; justify-content: space-between; "
    "gap: 10px; align-items: flex-start; }"
)
_CSS_NEW = (
    ".pf-head { display: flex; justify-content: space-between; "
    "gap: 10px; align-items: flex-start; }\n"
    "    .pf-qr { width: 96px; height: 96px; flex: 0 0 96px; }\n"
    "    .pf-qr svg { width: 96px; height: 96px; display: block; }"
)


def upgrade() -> None:
    op.add_column(
        "technical_cards",
        sa.Column("qr_token", sa.String(length=64), nullable=True),
    )
    op.create_unique_constraint(
        "uq_technical_cards_qr_token", "technical_cards", ["qr_token"]
    )

    op.add_column(
        "technical_card_unit_lines",
        sa.Column(
            "production_stage_id",
            sa.Integer(),
            sa.ForeignKey("production_stages.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.add_column(
        "technical_card_unit_lines",
        sa.Column("last_transfer_kind", sa.String(length=20), nullable=True),
    )
    op.add_column(
        "technical_card_unit_lines",
        sa.Column(
            "fg_receipt_posted",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )
    op.add_column(
        "technical_card_unit_lines",
        sa.Column(
            "fg_issue_posted",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )
    op.add_column(
        "technical_card_unit_lines",
        sa.Column(
            "is_scrapped",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )
    op.create_check_constraint(
        "ck_technical_card_unit_lines_last_transfer_kind",
        "technical_card_unit_lines",
        "last_transfer_kind IS NULL OR last_transfer_kind IN "
        "('accept', 'forward', 'return')",
    )
    op.create_index(
        "ix_technical_card_unit_lines_production_stage_id",
        "technical_card_unit_lines",
        ["production_stage_id"],
    )

    bind = op.get_bind()
    rows = bind.execute(
        sa.text(
            """
            SELECT v.id, v.template_source
            FROM print_form_versions v
            JOIN print_forms f ON f.id = v.print_form_id
            WHERE f.code = 'technical_card_a4_x2' AND v.is_current IS true
            """
        )
    ).mappings().all()
    for row in rows:
        source = row["template_source"] or ""
        if "{{ html.qr_block }}" in source:
            continue
        updated = source.replace(_CSS_OLD, _CSS_NEW).replace(_HEAD_OLD, _HEAD_NEW)
        if updated == source:
            continue
        bind.execute(
            sa.text(
                "UPDATE print_form_versions SET template_source = :src WHERE id = :id"
            ),
            {"src": updated, "id": row["id"]},
        )


def downgrade() -> None:
    bind = op.get_bind()
    rows = bind.execute(
        sa.text(
            """
            SELECT v.id, v.template_source
            FROM print_form_versions v
            JOIN print_forms f ON f.id = v.print_form_id
            WHERE f.code = 'technical_card_a4_x2' AND v.is_current IS true
            """
        )
    ).mappings().all()
    for row in rows:
        source = row["template_source"] or ""
        updated = source.replace(_HEAD_NEW, _HEAD_OLD).replace(_CSS_NEW, _CSS_OLD)
        if updated == source:
            continue
        bind.execute(
            sa.text(
                "UPDATE print_form_versions SET template_source = :src WHERE id = :id"
            ),
            {"src": updated, "id": row["id"]},
        )

    op.drop_index(
        "ix_technical_card_unit_lines_production_stage_id",
        table_name="technical_card_unit_lines",
    )
    op.drop_constraint(
        "ck_technical_card_unit_lines_last_transfer_kind",
        "technical_card_unit_lines",
        type_="check",
    )
    op.drop_column("technical_card_unit_lines", "is_scrapped")
    op.drop_column("technical_card_unit_lines", "fg_issue_posted")
    op.drop_column("technical_card_unit_lines", "fg_receipt_posted")
    op.drop_column("technical_card_unit_lines", "last_transfer_kind")
    op.drop_column("technical_card_unit_lines", "production_stage_id")
    op.drop_constraint("uq_technical_cards_qr_token", "technical_cards", type_="unique")
    op.drop_column("technical_cards", "qr_token")
