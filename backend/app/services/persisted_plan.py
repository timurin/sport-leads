"""Read saved planning dates; never run Scheduler or synthesize a fresh forecast."""
from sqlalchemy import select
from sqlalchemy.orm import Session
from pydantic import ValidationError
from app.models.calendar_assignment import CalendarAssignment
from app.models.technical_card import TechnicalCard
from app.schemas.persisted_plan import PersistedPlanSummary
from app.services.production_state import load_states
from app.schemas.production_state import ProductionState


def read_persisted_plan(db: Session, card: TechnicalCard, *, state: ProductionState | None = None) -> PersistedPlanSummary:
    from app.services.route_variants import active_stage_results
    planning_state = (state or load_states(db, [card])[card.id]).planning_state
    try:
        nodes = {row.id for row in active_stage_results(card) if row.tech_operation_id is not None}
    except ValidationError:
        # Shared resolver already exposes invalid_variant_snapshot; do not
        # invent a selected branch or a current forecast from malformed selection.
        return PersistedPlanSummary(planning_state='invalid', persisted=False,
            replan_required=True, shipping_date=card.shipping_date)
    with db.no_autoflush:
        rows = list(db.scalars(select(CalendarAssignment).where(
            CalendarAssignment.technical_card_id == card.id, CalendarAssignment.stage_result_id.in_(nodes))))
    start = min((row.planned_date for row in rows), default=None)
    end = max((row.planned_end_date for row in rows), default=None)
    buffer = (card.shipping_date - end).days if end is not None and card.shipping_date is not None else None
    return PersistedPlanSummary(planning_state=planning_state, persisted=bool(rows),
        is_current=planning_state == 'planned' and bool(rows),
        replan_required=planning_state in {'stale','invalid'} or (bool(rows) and planning_state != 'planned'),
        planned_start_date=start, planned_completion_date=end, shipping_date=card.shipping_date,
        on_time=None if buffer is None else buffer >= 0, buffer_days=buffer,
        delay_days=None if buffer is None else max(0, -buffer))
