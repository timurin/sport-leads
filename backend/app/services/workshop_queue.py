"""PC-05.6C: waiting operation order and atomic, bounded-scope replanning.

Preview overlays proposed allocations in memory, never in a SAVEPOINT with SQL
writes. Apply validates the same revision/result under the scheduler gate.
"""
from dataclasses import asdict, dataclass
from datetime import date, datetime, timezone
from decimal import localcontext
import hashlib
import json
from types import SimpleNamespace

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.models.auth import PlatformUser
from app.models.calendar_allocation import CalendarAllocation
from app.models.calendar_assignment import CalendarAssignment
from app.models.production_capacity import CapacityResource, ProductionCapacityException, TechOperationCapacityResource
from app.models.production_stage import ProductionStage
from app.models.shop_routing import WorkCenter
from app.models.tech_operation import TechOperation
from app.models.technical_card import TechnicalCard, TechnicalCardStageResult
from app.repositories import production_scheduler as repo
from app.schemas.production_diagnostics import DiagnosticTraceStep, ProductionDiagnostic
from app.schemas.production_schedule import ScheduleRead
from app.schemas.workshop_queue import (
    WorkshopQueueApplied, WorkshopQueueApply, WorkshopQueueChange, WorkshopQueueItem,
    WorkshopQueuePreview, WorkshopQueueRead, WorkshopQueueReorder,
)
from app.services.audit import append_audit_event
from app.services.production_demand import load_card_demand_snapshot
from app.services.production_scheduler import _build, _protected, _value, persist_plan, priority_sort_key
from app.services.technical_card_fact_projection import current_fact_stage
from app.services.technical_card_planning import planning_start_on, platform_timezone_name
from app.services.technical_cards import TechnicalCardConflictError, TechnicalCardNotFoundError

MESSAGES = {
    "queue_item_not_waiting": "В очереди можно менять порядок только ожидающих работ. Обновите список.",
    "queue_cross_workshop_reorder": "Можно менять порядок работ только одного участка.",
    "queue_contains_protected_fact": "Начатые, завершённые или закреплённые работы менять нельзя.",
    "workshop_queue_changed": "Очередь или производственный план изменились. Выполните новый предпросмотр.",
    "queue_replan_failed": "Не удалось безопасно пересчитать план. Проверьте причины и повторите предпросмотр.",
}


def diagnostic(code: str, workshop_id: int, **details) -> ProductionDiagnostic:
    return ProductionDiagnostic(
        code=code, category="INTEGRITY" if code != "queue_replan_failed" else "RUNTIME",
        module="calendar", entity_type="production_stage", entity_id=workshop_id,
        entity_name="Очередь участка", field="queue", field_label="Порядок ожидающих работ",
        message=MESSAGES[code], fix_scope="production_calendar", reason=code,
        fix_action="Обновить очередь и выполнить предпросмотр", expected_source="Selected pending snapshot / CalendarAssignment",
        debug_details=details, trace=(DiagnosticTraceStep(source="Workshop queue preflight", value=details, broken=True),),
    )


class WorkshopQueueConflict(TechnicalCardConflictError):
    def __init__(self, issue: ProductionDiagnostic):
        self.diagnostic = issue
        self.headers = {"X-Diagnostic-Code": issue.code, "X-Diagnostic-Category": issue.category}
        super().__init__(issue.message)


def _hash(value: object) -> str:
    return hashlib.sha256(json.dumps(value, sort_keys=True, ensure_ascii=False, default=str,
                                     separators=(",", ":")).encode()).hexdigest()


def _columns(row) -> dict:
    return {column.name: getattr(row, column.name) for column in row.__table__.columns}


def _risk(eta: date | None, shipping: date | None) -> str:
    return "unknown" if eta is None or shipping is None else "late" if eta > shipping else "on_time"


def _today(db: Session, today: date | None) -> date:
    return today or planning_start_on(datetime.now(timezone.utc), platform_timezone_name(db))


@dataclass
class _State:
    queue: WorkshopQueueRead
    cards: dict[int, TechnicalCard]
    assignments: list[CalendarAssignment]


def _read(db: Session, workshop_id: int, today: date) -> _State:
    workshop = db.get(ProductionStage, workshop_id)
    if workshop is None or not workshop.is_active:
        raise TechnicalCardNotFoundError("Участок не найден или отключён")
    cards = list(db.scalars(select(TechnicalCard).where(
        TechnicalCard.id.in_(select(TechnicalCardStageResult.technical_card_id).where(
            TechnicalCardStageResult.production_stage_id == workshop_id)),
        TechnicalCard.order_group_id.is_not(None), TechnicalCard.sales_order_id.is_(None),
        TechnicalCard.status.in_(["draft", "in_progress"]),
    ).options(selectinload(TechnicalCard.stage_results), selectinload(TechnicalCard.operation_lines),selectinload(TechnicalCard.route_edges))
        .order_by(TechnicalCard.id).execution_options(populate_existing=True)))
    assignments = list(db.scalars(select(CalendarAssignment).order_by(CalendarAssignment.id)
                                 .execution_options(populate_existing=True)))
    by_node = {row.stage_result_id: row for row in assignments if row.stage_result_id is not None}
    operations = {row.id: row for row in db.scalars(select(TechOperation).order_by(TechOperation.id))}
    from app.services.production_state import load_states
    states=load_states(db,cards)
    ordered=[]
    edges=[edge for card in cards for edge in card.route_edges]
    for card in cards:
        state=states[card.id]
        if state.current_workshop_id!=workshop_id or state.workshop_state!='waiting' or not state.ready_snapshot_nodes or card.plan_locked:
            continue
        node=next(row for row in card.stage_results if row.id==state.ready_snapshot_nodes[0])
        assignment = by_node.get(node.id)
        if assignment is not None and (assignment.manual_lock or assignment.planning_mode != "auto"
                                       or assignment.planned_date < today):
            continue
        operation = operations.get(node.tech_operation_id)
        if operation is None or not operation.is_active:
            continue
        explicit = assignment.queue_position if assignment else None
        key = (explicit is None, explicit or 0,
               assignment.planned_date if assignment else date.max,
               assignment.position if assignment else 0, priority_sort_key(card), node.id)
        own = [row for row in assignments if row.technical_card_id == card.id and row.stage_result_id is not None]
        eta = max((row.planned_end_date for row in own), default=None)
        item = WorkshopQueueItem(
            technical_card_id=card.id, technical_card_number=card.number, snapshot_node_id=node.id,
            workshop_id=workshop_id, workshop_name=workshop.name, operation_id=operation.id,
            operation_name=operation.name, queue_position=1, priority=card.priority,
            planned_start=assignment.planned_date if assignment else None,
            planned_end=assignment.planned_end_date if assignment else None,
            eta=eta, shipping_date=card.shipping_date, risk=_risk(eta, card.shipping_date),
        )
        ordered.append((key, item))
    items = [item.model_copy(update={"queue_position": index})
             for index, (_, item) in enumerate(sorted(ordered, key=lambda pair: pair[0]), 1)]
    # Conservative revision includes shared occupancy/configuration. The result fingerprint
    # additionally checks effective live Demand inputs and downstream ETA at apply time.
    stamp = {"day": today, "items": [item.model_dump() for item in items],
             "cards": [_columns(card) for card in cards],
             "nodes": [_columns(node) for card in cards for node in sorted(card.stage_results, key=lambda row: row.id)],
             "volumes": [_columns(row) for card in cards for row in sorted(card.operation_lines, key=lambda row: row.id)],
             "edges": [_columns(row) for row in edges],
             "assignments": [_columns(row) for row in assignments]}
    for model in (CalendarAllocation, CapacityResource, ProductionCapacityException, WorkCenter,
                  ProductionStage, TechOperation, TechOperationCapacityResource):
        query = select(model).order_by(*model.__table__.primary_key.columns)
        stamp[model.__tablename__] = [_columns(row) for row in db.scalars(query)]
    return _State(WorkshopQueueRead(workshop_id=workshop_id, revision=_hash(stamp), items=items),
                  {card.id: card for card in cards}, assignments)


def read_workshop_queue(db: Session, workshop_id: int, *, today: date | None = None) -> WorkshopQueueRead:
    with db.no_autoflush:
        return _read(db, workshop_id, _today(db, today)).queue


def respect_workshop_order(db: Session, cards: list[TechnicalCard]) -> list[TechnicalCard]:
    """Overlay stored waiting order only within each workshop's existing batch slots."""
    saved = {row.stage_result_id: row.queue_position for row in db.scalars(select(CalendarAssignment).where(
        CalendarAssignment.queue_position.is_not(None)))}
    groups: dict[int, list[tuple[int, TechnicalCard, int | None]]] = {}
    for index, card in enumerate(cards):
        node = current_fact_stage(card)
        if node is not None and _value(node.status) == "pending":
            groups.setdefault(node.production_stage_id, []).append((index, card, saved.get(node.id)))
    result = list(cards)
    for members in groups.values():
        if not any(position is not None for _, _, position in members):
            continue
        ordered = sorted(members, key=lambda item: (item[2] is None, item[2] or 0, item[0]))
        for (index, _, _), (_, card, _) in zip(members, ordered):
            result[index] = card
    return result


def _validate(db: Session, state: _State, payload: WorkshopQueueReorder) -> None:
    workshop_id = state.queue.workshop_id
    if payload.revision != state.queue.revision:
        raise WorkshopQueueConflict(diagnostic("workshop_queue_changed", workshop_id))
    requested = payload.ordered_snapshot_node_ids
    expected = {item.snapshot_node_id for item in state.queue.items}
    nodes = {node.id: node for node in db.scalars(select(TechnicalCardStageResult).where(
        TechnicalCardStageResult.id.in_(requested)))}
    for node in nodes.values():
        if node.production_stage_id != workshop_id:
            raise WorkshopQueueConflict(diagnostic("queue_cross_workshop_reorder", workshop_id, snapshot_node_id=node.id))
        if _value(node.status) in {"in_progress", "completed"}:
            raise WorkshopQueueConflict(diagnostic("queue_contains_protected_fact", workshop_id, snapshot_node_id=node.id))
        owner = db.get(TechnicalCard, node.technical_card_id)
        saved = next((row for row in state.assignments if row.stage_result_id == node.id), None)
        if owner.plan_locked or (saved is not None and (saved.manual_lock or saved.planning_mode != "auto")):
            raise WorkshopQueueConflict(diagnostic("queue_contains_protected_fact", workshop_id, snapshot_node_id=node.id))
    if len(set(requested)) != len(requested) or set(requested) != expected:
        raise WorkshopQueueConflict(diagnostic("queue_item_not_waiting", workshop_id,
                                               requested_snapshot_node_ids=requested, expected_snapshot_node_ids=sorted(expected)))


def _proposal(db: Session, state: _State, payload: WorkshopQueueReorder, today: date
              ) -> tuple[WorkshopQueuePreview, dict[int, set[int]]]:
    _validate(db, state, payload)
    previous = [item.snapshot_node_id for item in state.queue.items]
    requested = payload.ordered_snapshot_node_ids
    preview = WorkshopQueuePreview(workshop_id=state.queue.workshop_id, revision=state.queue.revision,
                                    preview_fingerprint="", can_apply=True)
    if previous == requested:
        preview.preview_fingerprint = _hash(preview.model_dump())
        return preview, {}
    first = next(index for index, pair in enumerate(zip(previous, requested)) if pair[0] != pair[1])
    affected = requested[first:]
    items = {item.snapshot_node_id: item for item in state.queue.items}
    inputs, snapshots, scopes, replacement = {}, {}, {}, {}
    for node_id in affected:
        item = items[node_id]
        card = state.cards[item.technical_card_id]
        snapshot = load_card_demand_snapshot(db, card.id)
        data = repo.read_inputs(db, card, snapshot, False)
        scope = {node_id}
        source_ids = {step.routing_stage_line_id for step in snapshot.steps if step.snapshot_node_id in scope}
        while True:
            descendants = {step.snapshot_node_id for step in snapshot.steps if set(step.predecessor_ids) & source_ids}
            if descendants <= scope:
                break
            scope |= descendants
            source_ids = {step.routing_stage_line_id for step in snapshot.steps if step.snapshot_node_id in scope}
        facts = {row.stage_order for row in data["facts"] if _value(row.status) in {"in_progress", "completed"}}
        step_by_id = {step.routing_stage_line_id: step for step in snapshot.steps}
        replacement[card.id] = {row.id for row in data["own"] if row.stage_result_id in scope
                                and not _protected(row, facts, step_by_id, today)}
        data["replan_node_ids"] = scope
        scopes[card.id], snapshots[card.id], inputs[card.id] = scope, snapshot, data
    removed = set().union(*replacement.values())
    virtual = []
    for node_id in affected:
        item = items[node_id]
        card = state.cards[item.technical_card_id]
        data = inputs[card.id]
        data["allocations"] = [(allocation, owner) for allocation, owner in data["allocations"] if owner.id not in removed]
        keys = {row.resource_key for row in data["resources"]}
        data["allocations"] += [(allocation, owner) for allocation, owner in virtual if allocation.resource_key in keys]
        data["snapshot_nodes"].update({node.id: node for candidate in state.cards.values() for node in candidate.stage_results})
        known_volumes = {row.id for row in data["volumes"]}
        data["volumes"] += [row for candidate in state.cards.values() for row in candidate.operation_lines
                            if row.id not in known_volumes and _value(row.source_kind) == "routing"]
        result, _ = _build(card, snapshots[card.id], data, today)
        if result.status != "planned":
            preview.can_apply = False
            preview.blockers.append(diagnostic("queue_replan_failed", state.queue.workshop_id,
                technical_card_id=card.id, scheduler_deviations=[row.model_dump(mode="json") for row in result.deviations]))
            break
        preview.affected_plans.append(result)
        for step in result.steps:
            if step.preserved:
                continue
            owner = SimpleNamespace(id=-step.snapshot_node_id, technical_card_id=card.id,
                                    stage_result_id=step.snapshot_node_id, routing_stage_line_id=step.routing_stage_line_id)
            for allocation in step.allocations:
                virtual.append((allocation, owner))
        selected = next(step for step in result.steps if step.snapshot_node_id == node_id)
        preview.changes.append(WorkshopQueueChange(
            snapshot_node_id=node_id, technical_card_id=card.id, old_position=item.queue_position,
            new_position=requested.index(node_id) + 1, old_planned_start=item.planned_start,
            new_planned_start=selected.planned_start_date, old_planned_end=item.planned_end,
            new_planned_end=selected.planned_end_date, old_eta=item.eta, new_eta=result.planned_completion_date,
            old_risk=item.risk, new_risk=_risk(result.planned_completion_date, item.shipping_date),
            downstream_snapshot_node_ids=[step.snapshot_node_id for step in result.steps
                                          if not step.preserved and step.snapshot_node_id != node_id],
        ))
        if result.on_time is False:
            preview.warnings.append(diagnostic("queue_replan_failed", state.queue.workshop_id,
                                               technical_card_id=card.id, reason="deadline_missed").model_copy(update={
                "code": "queue_shipping_risk_increased", "severity": "warning",
                "reason": "deadline_missed", "message": "После перестановки работа завершится позже срока отгрузки."}))
    preview.preview_fingerprint = _hash({"preview": preview.model_dump(),
                                        "demand_inputs": [asdict(snapshots[key]) for key in sorted(snapshots)]})
    return preview, replacement


def preview_workshop_queue(db: Session, workshop_id: int, payload: WorkshopQueueReorder,
                           *, today: date | None = None) -> WorkshopQueuePreview:
    repo.lock_scheduler(db)
    with db.no_autoflush, localcontext() as context:
        context.prec = 28
        current = _today(db, today)
        state = _read(db, workshop_id, current)
        try:
            return _proposal(db, state, payload, current)[0]
        except WorkshopQueueConflict:
            raise
        except (TechnicalCardConflictError, ValueError) as error:
            raise WorkshopQueueConflict(diagnostic("queue_replan_failed", workshop_id, reason=type(error).__name__)) from error


def apply_workshop_queue(db: Session, workshop_id: int, payload: WorkshopQueueApply,
                         *, actor: PlatformUser | None, today: date | None = None) -> WorkshopQueueApplied:
    try:
        repo.lock_scheduler(db)
        with db.no_autoflush, localcontext() as context:
            context.prec = 28
            current = _today(db, today)
            state = _read(db, workshop_id, current)
            preview, replacement = _proposal(db, state, payload, current)
            if payload.preview_fingerprint != preview.preview_fingerprint:
                raise WorkshopQueueConflict(diagnostic("workshop_queue_changed", workshop_id))
            if not preview.can_apply:
                raise WorkshopQueueConflict(preview.blockers[0])
            if not preview.affected_plans:
                db.rollback()
                return WorkshopQueueApplied(queue=state.queue, preview=preview)
            for result in preview.affected_plans:
                persist_plan(db, result, replacement[result.technical_card_id])
                result.persisted = True
            for position, node_id in enumerate(payload.ordered_snapshot_node_ids, 1):
                assignment = db.scalar(select(CalendarAssignment).where(CalendarAssignment.stage_result_id == node_id))
                if assignment is None:
                    raise WorkshopQueueConflict(diagnostic("queue_replan_failed", workshop_id, snapshot_node_id=node_id))
                assignment.queue_position = position
            db.flush()
            event = append_audit_event(db, actor=actor, action="production_calendar.workshop_queue_reordered",
                entity_type="production_stage", entity_id=workshop_id, source="workshop_queue",
                payload={"workshop_id": workshop_id, "old_order": [item.snapshot_node_id for item in state.queue.items],
                         "new_order": payload.ordered_snapshot_node_ids, "revision": state.queue.revision,
                         "affected_technical_card_ids": sorted(replacement),
                         "affected_snapshot_node_ids": sorted({step.snapshot_node_id for plan in preview.affected_plans
                                                                for step in plan.steps if not step.preserved}),
                         "replan_result": preview.model_dump(mode="json")})
            response = WorkshopQueueApplied(queue=_read(db, workshop_id, current).queue,
                                             preview=preview, audit_event_id=event.id)
        db.commit()
        return response
    except WorkshopQueueConflict:
        db.rollback()
        raise
    except (TechnicalCardConflictError, ValueError, IntegrityError) as error:
        db.rollback()
        raise WorkshopQueueConflict(diagnostic("queue_replan_failed", workshop_id, reason=type(error).__name__)) from error
    except Exception:
        db.rollback()
        raise
