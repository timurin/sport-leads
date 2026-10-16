"""Whole-card fulfillment; warehouse integration is deferred (PC-06.1A v2)."""
from datetime import datetime, timezone

from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.models.technical_card import TechnicalCard, TechnicalCardOrderGroup
from app.models.sales import SalesOrder
from app.services.audit import append_audit_event
from app.services.technical_cards import TechnicalCardConflictError

from app.schemas.technical_card_fulfillment import FulfillmentRead

LEGACY_CODES = frozenset({"ready_to_ship", "shipped"})


def production_nodes(nodes):
    """Retain legacy FG rows, but exclude catalog-identified markers from production."""
    return [row for row in nodes if not (
        row.tech_operation_id is None
        and getattr(getattr(row, "production_stage", None), "code", None) in LEGACY_CODES
    )]


def on_ready_to_ship(db: Session, card: TechnicalCard) -> None:
    """Future warehouse receipt boundary. Currently no warehouse effects."""


def on_shipped(db: Session, card: TechnicalCard) -> None:
    """Future warehouse issue boundary. Currently no warehouse effects."""


def sync_ready(db: Session, card: TechnicalCard, *, actor=None) -> None:
    from app.services.production_state import resolve_fact_state
    if resolve_fact_state(card).lifecycle_status != "completed" or card.fulfillment_status:
        return
    card.fulfillment_status = "ready_to_ship"
    from app.services.route_variants import active_stage_results
    card.ready_to_ship_at = max(
        (row.completed_at.replace(tzinfo=timezone.utc) if row.completed_at.tzinfo is None else row.completed_at
         for row in production_nodes(active_stage_results(card))
         if row.is_required and row.completed_at is not None),
        default=datetime.now(timezone.utc),
    )
    on_ready_to_ship(db, card)
    append_audit_event(db, actor=actor, action="fulfillment.ready_to_ship",
                       entity_type="technical_card", entity_id=card.id,
                       payload={"quantity": str(card.quantity), "warehouse_integration": "deferred"})


def assert_not_shipped(card: TechnicalCard) -> None:
    if card.fulfillment_status == "shipped":
        raise TechnicalCardConflictError("Техкарта уже отгружена. Возврат в производство не предусмотрен.")


def mark_shipped(db: Session, card_id: int, *, actor) -> TechnicalCard:
    from app.services.technical_card_stages import _locked_technical_card
    from app.services.production_state import resolve_fact_state
    card = _locked_technical_card(db, card_id)
    assert_not_shipped(card)
    if resolve_fact_state(card).lifecycle_status != "completed" or card.status != "completed":
        raise TechnicalCardConflictError("Отгрузка невозможна: производство ещё не завершено.")
    if card.fulfillment_status != "ready_to_ship":
        raise TechnicalCardConflictError("Техкарта не передана в готовые к отгрузке. Проверьте состояние производства.")
    card.fulfillment_status = "shipped"
    card.shipped_at = datetime.now(timezone.utc)
    on_shipped(db, card)
    append_audit_event(db, actor=actor, action="fulfillment.shipped", entity_type="technical_card",
                       entity_id=card.id, payload={"quantity": str(card.quantity),
                       "ready_to_ship_at": card.ready_to_ship_at.isoformat(),
                       "shipped_at": card.shipped_at.isoformat(), "warehouse_integration": "deferred"})
    db.commit()
    return card


def list_fulfillment(db: Session, status: str, *, limit=500, offset=0) -> list[FulfillmentRead]:
    # One slim joined query, no per-row loads or read-side state repair.
    rows = db.execute(select(
        TechnicalCard.id, TechnicalCard.number,
        func.coalesce(SalesOrder.number, TechnicalCardOrderGroup.order_number).label("order_number"),
        TechnicalCard.product_model_article, TechnicalCard.product_model_name,
        TechnicalCard.quantity, TechnicalCard.fulfillment_status,
        TechnicalCard.ready_to_ship_at, TechnicalCard.shipped_at, TechnicalCard.shipping_date,
    ).outerjoin(SalesOrder, SalesOrder.id == TechnicalCard.sales_order_id)
     .outerjoin(TechnicalCardOrderGroup, TechnicalCardOrderGroup.id == TechnicalCard.order_group_id)
     .where(TechnicalCard.fulfillment_status == status, TechnicalCard.status == "completed")
     .order_by(TechnicalCard.shipped_at.desc() if status == "shipped" else TechnicalCard.ready_to_ship_at.desc(),
               TechnicalCard.id.desc()).offset(offset).limit(limit)).mappings()
    return [FulfillmentRead(**{**row, "model": " · ".join(filter(None, [row["product_model_article"], row["product_model_name"]])) or None}) for row in rows]
