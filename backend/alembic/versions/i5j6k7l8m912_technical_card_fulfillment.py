"""Separate whole-card fulfillment, warehouse deferred.

Revision ID: i5j6k7l8m912
Revises: h4i5j6k7l801
"""
from alembic import op
import sqlalchemy as sa
from collections import defaultdict

revision = "i5j6k7l8m912"
down_revision = "h4i5j6k7l801"
branch_labels = None
depends_on = None

CONSTRAINT = "ck_technical_cards_fulfillment"
EXPRESSION = (
    "COALESCE((fulfillment_status IS NULL AND ready_to_ship_at IS NULL AND shipped_at IS NULL) OR "
    "(fulfillment_status = 'ready_to_ship' AND ready_to_ship_at IS NOT NULL AND shipped_at IS NULL) OR "
    "(fulfillment_status = 'shipped' AND ready_to_ship_at IS NOT NULL AND shipped_at IS NOT NULL), false)"
)


def upgrade():
    op.add_column("technical_cards", sa.Column("fulfillment_status", sa.String(20), nullable=True))
    op.add_column("technical_cards", sa.Column("ready_to_ship_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("technical_cards", sa.Column("shipped_at", sa.DateTime(timezone=True), nullable=True))
    op.create_check_constraint(CONSTRAINT, "technical_cards", EXPRESSION)
    # Conservative historical backfill: proven required selected production facts
    # only. Align lifecycle/pointer caches, never snapshot, unit, Calendar or stock facts.
    connection = op.get_bind()
    cards = connection.execute(sa.text("SELECT id, route_variant_groups, route_variant_selections FROM technical_cards WHERE status IN ('draft','in_progress','completed')")).mappings().all()
    grouped = defaultdict(list)
    for row in connection.execute(sa.text("""SELECT r.technical_card_id,r.id,r.is_required,r.status,r.completed_at
        FROM technical_card_stage_results r LEFT JOIN production_stages p ON p.id=r.production_stage_id
        JOIN technical_cards t ON t.id=r.technical_card_id AND t.status IN ('draft','in_progress','completed')
        WHERE NOT (r.tech_operation_id IS NULL AND COALESCE(p.code,'') IN ('ready_to_ship','shipped'))""")).mappings():
        grouped[row["technical_card_id"]].append(row)
    for card in cards:
        excluded = set()
        unresolved = False
        for group in card["route_variant_groups"] or []:
            members = {member["operation_node_id"] for member in group["members"]}
            selected = (card["route_variant_selections"] or {}).get(group["id"], {}).get("selected_operation_snapshot_node_id")
            if group.get("active", True) and selected not in members:
                unresolved = True
            excluded.update(members - ({selected} if group.get("active", True) else set()))
        required = [row for row in grouped[card["id"]] if row["is_required"] and f'snapshot:{row["id"]}' not in excluded]
        if unresolved or not required or any(row["status"] != "completed" or row["completed_at"] is None for row in required):
            continue
        # Existing posted warehouse issues are historical shipping evidence, not
        # authorization to perform or invent the new fulfillment transition.
        issue = connection.scalar(sa.text("SELECT COUNT(*) FROM stock_documents WHERE technical_card_id=:id AND doc_type='fg_issue' AND status='posted'"), {"id": card["id"]})
        if issue:
            continue
        connection.execute(sa.text("UPDATE technical_cards SET fulfillment_status='ready_to_ship',ready_to_ship_at=:at,status='completed',current_stage_order=NULL,current_stage_label=NULL WHERE id=:id"),
                           {"id": card["id"], "at": max(row["completed_at"] for row in required)})


def downgrade():
    op.drop_constraint(CONSTRAINT, "technical_cards", type_="check")
    op.drop_column("technical_cards", "shipped_at")
    op.drop_column("technical_cards", "ready_to_ship_at")
    op.drop_column("technical_cards", "fulfillment_status")
