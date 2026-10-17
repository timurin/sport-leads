"""Read saved plan/fact once per batch. Never schedule, persist or repair on read."""
from collections import defaultdict
from datetime import date
from types import SimpleNamespace

from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.calendar_assignment import CalendarAssignment
from app.models.production_stage import ProductionStage
from app.models.sewing_work_ledger import SewingWorkLedgerEntry
from app.models.stock import StockLedgerLine
from app.models.technical_card import TechnicalCard, TechnicalCardStageResult
from app.schemas.planning_health import PlanningHealth, OperationPlanningHealth, ManualPlanningCardHealth
from app.services.persisted_plan import read_persisted_plan, planning_risk
from app.services.manual_replan_guards import manual_replan_is_protected
from app.services.production_state import load_states, value
from app.services.route_reapply import protected_nodes
from app.services.route_variants import active_stage_results
from app.services.technical_card_planning import new_card_planning_start
from app.services.technical_cards import TechnicalCardNotFoundError


def _options():
    return (selectinload(TechnicalCard.stage_results).selectinload(TechnicalCardStageResult.production_stage),
            selectinload(TechnicalCard.composition_lines), selectinload(TechnicalCard.unit_lines),
            selectinload(TechnicalCard.operation_lines))


def load_planning_health(db: Session, cards: list[TechnicalCard], *, today: date | None = None) -> dict[int, PlanningHealth]:
    """Fixed query count for summaries and detail, including canonical fact guards."""
    if not cards:
        return {}
    with db.no_autoflush:
        # Also preload for callers supplying cards with unloaded relationships.
        ids = {card.id for card in cards}
        cards = list(db.scalars(select(TechnicalCard).where(TechnicalCard.id.in_(ids)).options(*_options())))
        current = today if today is not None else new_card_planning_start(db)
        states = load_states(db, cards)
        assignments = defaultdict(list)
        for row in db.scalars(select(CalendarAssignment).where(CalendarAssignment.technical_card_id.in_(ids))):
            assignments[row.technical_card_id].append(row)
        ledger = defaultdict(list)
        for row in db.scalars(select(SewingWorkLedgerEntry).where(SewingWorkLedgerEntry.technical_card_id.in_(ids))):
            ledger[row.technical_card_id].append(row)
        stock_cards = set(db.scalars(select(StockLedgerLine.technical_card_id).where(StockLedgerLine.technical_card_id.in_(ids))))
        workshops = {row.id: row.name for row in db.scalars(select(ProductionStage))}
        sewing = set(db.scalars(select(ProductionStage.id).where(ProductionStage.code == 'sewing')))
        result = {}
        for card in cards:
            state = states[card.id]
            summary = read_persisted_plan(db, card, state=state, assignments=assignments[card.id])
            terminal = (state.lifecycle_status in {'completed', 'cancelled'} or
                        value(card.status) in {'completed', 'cancelled'} or card.fulfillment_status == 'shipped')
            completed = state.lifecycle_status == 'completed' or value(card.status) == 'completed' or card.fulfillment_status == 'shipped'
            try:
                nodes = sorted((node for node in active_stage_results(card) if node.tech_operation_id is not None),
                               key=lambda node: (node.stage_order, node.id))
            except ValidationError:
                nodes = []  # invalid state is explicit; never guess a selected branch
            protected = protected_nodes(db, card, ledger=ledger[card.id], has_stock=card.id in stock_cards,
                                        sewing_workshop_ids=sewing)
            saved = {row.stage_result_id: row for row in assignments[card.id] if row.stage_result_id is not None}
            operations = []
            for node in nodes:
                row = saved.get(node.id)
                fact = node.id in protected
                locked = manual_replan_is_protected(card, state, node,
                    row if row is not None else SimpleNamespace(planning_mode='auto', manual_lock=False), protected)
                valid_binding = row is not None and row.production_stage_id == node.production_stage_id and (
                    row.routing_stage_line_id == (node.source_routing_stage_line_id or node.id)) and row.planned_end_date >= row.planned_date
                overdue = (not terminal and value(node.status) == 'pending' and not fact and
                           row is not None and row.planned_date < current)
                operations.append(OperationPlanningHealth(snapshot_node_id=node.id,
                    operation_name=node.operation_name or node.stage_label, workshop_id=node.production_stage_id,
                    workshop_name=workshops.get(node.production_stage_id, node.stage_label), operation_status=value(node.status),
                    planned_start=None if row is None else row.planned_date,
                    planned_end=None if row is None else row.planned_end_date, is_overdue=overdue,
                    overdue_days=(current - row.planned_date).days if overdue else 0, is_protected=bool(locked),
                    can_replan=not locked and value(node.status) == 'pending' and valid_binding,
                    warning_code='manual_replan_protected' if locked else 'saved_selected_operation_required' if not valid_binding else None))
            # Stable sort preserves snapshot order as the equal-date tie breaker.
            overdue_ops = sorted((op for op in operations if op.is_overdue), key=lambda op: op.planned_start)
            earliest = next(iter(overdue_ops), None)
            future = next((op for op in operations if not terminal and op.operation_status == 'pending'
                           and op.snapshot_node_id not in state.current_snapshot_nodes), None)
            health_state = ('completed' if completed else 'invalid' if state.planning_state == 'invalid' else
                            'stale' if state.planning_state in {'stale', 'partial'} else
                            'actual' if summary.is_current else 'not_planned')
            replan = not terminal and (summary.replan_required or bool(overdue_ops))
            result[card.id] = PlanningHealth(technical_card_id=card.id, planning_date=current,
                planning_state=health_state, replan_required=replan, eta=summary.planned_completion_date,
                shipping_date=summary.shipping_date, slack_days=summary.buffer_days, on_time=summary.on_time,
                risk_level=planning_risk(summary.planned_completion_date, summary.shipping_date),
                current_workshop_id=state.current_workshop_id, current_workshop_name=state.current_workshop_name,
                route_total_operations=len(operations), completed_operations=sum(op.operation_status == 'completed' for op in operations),
                in_progress_operations=sum(op.operation_status == 'in_progress' for op in operations),
                pending_operations=sum(op.operation_status == 'pending' for op in operations),
                has_overdue_operations=bool(overdue_ops), overdue_operation_count=len(overdue_ops),
                earliest_overdue_operation=None if earliest is None else earliest.operation_name,
                earliest_overdue_snapshot_node_id=None if earliest is None else earliest.snapshot_node_id,
                earliest_overdue_workshop=None if earliest is None else earliest.workshop_name,
                earliest_overdue_date=None if earliest is None else earliest.planned_start,
                overdue_days=0 if earliest is None else earliest.overdue_days,
                next_operation=None if future is None else future.operation_name,
                next_snapshot_node_id=None if future is None else future.snapshot_node_id,
                next_operation_date=None if future is None else future.planned_start,
                has_planning_issues=not terminal and (replan or health_state == 'not_planned' or summary.on_time is False),
                operations=operations)
        return result


def read_planning_health(db: Session, card_id: int) -> PlanningHealth:
    with db.no_autoflush:
        card = db.get(TechnicalCard, card_id)
        if card is None:
            raise TechnicalCardNotFoundError('Technical card not found')
        return load_planning_health(db, [card])[card_id]


def list_manual_planning_health(db: Session, *, limit: int = 100, offset: int = 0) -> list[ManualPlanningCardHealth]:
    with db.no_autoflush:
        cards = list(db.scalars(select(TechnicalCard).where(
            TechnicalCard.order_group_id.is_not(None), TechnicalCard.status.in_(['draft', 'in_progress']),
            TechnicalCard.fulfillment_status.is_distinct_from('shipped')).order_by(TechnicalCard.id).limit(limit).offset(offset)))
        health = load_planning_health(db, cards)
        return [ManualPlanningCardHealth(**health[card.id].model_dump(exclude={'operations'}), number=card.number)
                for card in cards if health[card.id].planning_state != 'completed']
