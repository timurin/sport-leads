"""Read-only proposal and atomic scoped apply using the existing Scheduler."""
from dataclasses import asdict
from datetime import date, datetime, timezone
from decimal import localcontext
from types import SimpleNamespace
import hashlib
import json

from sqlalchemy import select
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from pydantic import ValidationError

from app.models.calendar_assignment import CalendarAssignment
from app.repositories import production_scheduler as repo
from app.schemas.manual_route_replan import (
    ManualReplanRequest, ManualReplanApply, ManualReplanChange, ManualReplanPreview, ManualReplanApplied,
)
from app.schemas.production_schedule import ScheduledAllocation
from app.schemas.production_diagnostics import ProductionDiagnostic
from app.services.production_scheduler import _build, _protected, persist_plan
from app.services.production_demand import load_card_demand_snapshot
from app.services.production_state import load_states
from app.services.technical_card_planning import planning_start_on, platform_timezone_name
from app.services.technical_cards import TechnicalCardConflictError, TechnicalCardNotFoundError
from app.services.persisted_plan import read_persisted_plan, planning_risk
from app.services.audit import append_audit_event
from app.services.manual_replan_guards import manual_replan_is_protected

MESSAGES = {
    'manual_replan_changed': 'План или исходные данные изменились. Выполните новый предпросмотр.',
    'manual_replan_protected': 'Нельзя переносить начатую, завершённую операцию или защищённый план. Производственный факт и блокировки сохранены.',
    'manual_replan_dependency': 'Перенос только этой операции нарушает последовательность маршрута. Используйте режим «Эту и последующие».',
    'manual_replan_capacity': 'На выбранную дату нет подходящей мощности. Выберите другую дату и повторите предпросмотр.',
    'manual_replan_blocked': 'Не удалось безопасно пересчитать маршрут. Проверьте причины в предпросмотре.',
}


def issue(code: str, card_id: int, **details) -> ProductionDiagnostic:
    return ProductionDiagnostic(code=code, category='INTEGRITY' if code in {
        'manual_replan_changed','manual_replan_protected'} else 'DATA_FLOW', module='calendar',
        entity_type='technical_card', entity_id=card_id, entity_name=f'ТК {card_id}', field='manual_planning',
        field_label='Перенос операции', message=MESSAGES[code], fix_scope='technical_card',
        fix_action='Выполнить новый предпросмотр', debug_details=details)


class ManualReplanConflict(TechnicalCardConflictError):
    def __init__(self, diagnostic: ProductionDiagnostic):
        self.diagnostic = diagnostic
        super().__init__(diagnostic.message)


def columns(row):
    return {column.name:getattr(row,column.name) for column in row.__table__.columns}


def digest(value) -> str:
    return hashlib.sha256(json.dumps(value, sort_keys=True, default=str,
        separators=(',',':'), ensure_ascii=False).encode()).hexdigest()


def _risk(end, shipping):
    return planning_risk(end, shipping)


def _proposal(db: Session, request: ManualReplanRequest, today: date):
    card = repo.read_card(db, request.technical_card_id, False)
    if card is None:
        raise TechnicalCardNotFoundError('Техкарта не найдена')
    try:
        snapshot = load_card_demand_snapshot(db, card.id)
    except ValidationError as error:
        raise ManualReplanConflict(issue('manual_replan_blocked',card.id,reason='invalid_snapshot')) from error
    data = repo.read_inputs(db, card, snapshot, False)
    stamp = dict(day=today, card=columns(card), snapshot=asdict(snapshot),
        route=None if data['route'] is None else columns(data['route']),
        occupancy=[(columns(a),columns(owner)) for a,owner in data['allocations']])
    for key in ('own','resources','exceptions','facts','stages','centers','operations','volumes'):
        stamp[key] = sorted((columns(row) for row in data[key]), key=lambda row:json.dumps(row,sort_keys=True,default=str))
    stamp['linkage'] = [row.model_dump(mode='json') for row in data['linkage_issues']]
    stamp['stale'] = sorted(data['stale_assignment_ids'])
    revision = digest(stamp)
    if request.revision is not None and request.revision != revision:
        raise ManualReplanConflict(issue('manual_replan_changed',card.id))
    by_node = {step.snapshot_node_id:step for step in snapshot.steps}
    saved = {row.stage_result_id:row for row in data['own'] if row.stage_result_id is not None}
    state=load_states(db,[card])[card.id]
    old_summary=read_persisted_plan(db,card,state=state)
    old_eta=old_summary.planned_completion_date
    preview = ManualReplanPreview(technical_card_id=card.id, snapshot_node_id=request.snapshot_node_id,
        target_date=request.target_date,mode=request.mode,revision=revision,old_eta=old_eta,
        new_eta=old_eta,shipping_date=card.shipping_date,
        old_slack=old_summary.buffer_days,
        risk_before=_risk(old_eta,card.shipping_date),risk_after=_risk(old_eta,card.shipping_date))
    def blocked(code, **details):
        diagnostic=issue(code,card.id,**details)
        if details.get('reason')=='downstream_protected':
            blocked_node=next((item for item in data['facts'] if item.id==details.get('snapshot_node_id')),None)
            label=(blocked_node.operation_name or blocked_node.stage_label) if blocked_node is not None else str(details.get('snapshot_node_id'))
            diagnostic=diagnostic.model_copy(update={'message':f'Зависимая операция «{label}» имеет производственный факт или закреплённый план. Перенос невозможен.'})
        preview.blockers.append(diagnostic)
        if code=='manual_replan_capacity': preview.capacity_warnings.append(diagnostic)
        if code=='manual_replan_dependency': preview.dependency_warnings.append(diagnostic)
        preview.preview_fingerprint=digest(preview.model_dump(mode='json'))
        return preview,set()
    step=by_node.get(request.snapshot_node_id)
    row=saved.get(request.snapshot_node_id)
    node=next((item for item in data['facts'] if item.id==request.snapshot_node_id),None)
    preview.old_selected_start=None if row is None else row.planned_date
    preview.old_selected_end=None if row is None else row.planned_end_date
    preview.new_selected_start=request.target_date
    from app.services.route_reapply import protected_nodes
    protected=protected_nodes(db,card)
    if step is None or row is None or node is None:
        return blocked('manual_replan_blocked',reason='saved_selected_operation_required')
    if request.target_date<today:
        return blocked('manual_replan_blocked',reason='target_date_in_past')
    if manual_replan_is_protected(card,state,node,row,protected):
        return blocked('manual_replan_protected',snapshot_node_id=node.id,assignment_id=row.id,reason='fact_or_lock_or_terminal')
    scope={node.id}
    source_ids={step.routing_stage_line_id}
    descendants=set()
    while True:
        following={s.snapshot_node_id for s in snapshot.steps if set(s.predecessor_ids)&source_ids}
        if following<=descendants: break
        descendants|=following
        source_ids|={by_node[n].routing_stage_line_id for n in descendants}
    preview.downstream_snapshot_node_ids=sorted(descendants)
    if request.mode=='downstream': scope|=descendants
    data['editable_overdue_node_ids']={item.id for item in data['facts'] if item.id in scope
        and item.status=='pending' and item.started_at is None and item.completed_at is None
        and item.id not in protected}
    # Only the explicitly selected pending manual adjustment may be superseded.
    # Other manual/locked/past/fact rows remain ordinary protected anchors.
    clone=SimpleNamespace(**columns(row))
    clone.manual_lock=False
    clone.planning_mode='auto'
    data['own']=[clone if item.id==row.id else item for item in data['own']]
    data['own']=[SimpleNamespace(**{**columns(item),'manual_lock':True})
        if isinstance(item,CalendarAssignment) and item.stage_result_id in protected else item for item in data['own']]
    data['replan_node_ids']=scope
    data['not_before_by_node']={node.id:request.target_date}
    plan,replace_ids=_build(card,snapshot,data,today)
    preview.plan=plan
    if plan.status!='planned':
        reasons=[item.model_dump(mode='json') for item in plan.deviations]
        if request.mode=='downstream':
            conflicting={item.routing_stage_line_id for item in plan.deviations if item.reason=='anchor_predecessor_conflict'}
            locked=next((item for item in data['own'] if item.routing_stage_line_id in conflicting and
                (item.stage_result_id in protected or item.manual_lock or item.planning_mode!='auto')),None)
            if locked is not None:
                return blocked('manual_replan_protected',snapshot_node_id=locked.stage_result_id,
                    assignment_id=locked.id,reason='downstream_protected',scheduler_deviations=reasons)
        dependency=any('predecessor' in item.reason for item in plan.deviations)
        capacity=any(item.code in {'capacity_missing','no_available_capacity','capacity_unit_mismatch'} for item in plan.deviations)
        return blocked('manual_replan_dependency' if dependency else 'manual_replan_capacity' if capacity else 'manual_replan_blocked', scheduler_deviations=reasons)
    # Past anchors remain historical in ordinary Scheduler calls. A manual move
    # must also validate their successor edges, including single-mode old plans.
    scheduled={item.routing_stage_line_id:item for item in plan.steps}
    for dependent in snapshot.steps:
        after=scheduled[dependent.routing_stage_line_id]
        for predecessor_id in dependent.predecessor_ids:
            before=scheduled.get(predecessor_id)
            if before is not None and after.planned_start_date<before.planned_end_date:
                owner=saved.get(dependent.snapshot_node_id)
                locked=owner is not None and (owner.stage_result_id in protected or owner.manual_lock or owner.planning_mode!='auto')
                return blocked('manual_replan_protected' if request.mode=='downstream' and locked else 'manual_replan_dependency',
                    snapshot_node_id=dependent.snapshot_node_id,predecessor_snapshot_node_id=before.snapshot_node_id,
                    reason='downstream_protected' if locked else 'successor_before_predecessor_end')
    selected=next(item for item in plan.steps if item.snapshot_node_id==node.id)
    preview.new_selected_start=selected.planned_start_date
    preview.new_selected_end=selected.planned_end_date
    if selected.planned_start_date!=request.target_date:
        predecessor_ids=set(step.predecessor_ids)
        predecessor_end=max((s.planned_end_date for s in plan.steps if s.routing_stage_line_id in predecessor_ids),default=today)
        return blocked('manual_replan_dependency' if predecessor_end>request.target_date else 'manual_replan_capacity',
            earliest_available_start=selected.planned_start_date.isoformat(),
            resources=[item.model_dump(mode='json') for item in selected.allocations])
    workshops={workshop.id:workshop.name for workshop in data['stages']}
    for item in plan.steps:
        if item.preserved: continue
        old=saved.get(item.snapshot_node_id)
        if old is None:
            return blocked('manual_replan_blocked',reason='complete_saved_route_required')
        old_allocations=[ScheduledAllocation(resource_key=a.resource_key,date=a.date,allocated_amount=a.allocated_amount,
            capacity_unit=a.capacity_unit,work_center_id=next((r.work_center_id for r in data['resources'] if r.resource_key==a.resource_key),None))
            for a,owner in data['allocations'] if owner.id==old.id]
        change=ManualReplanChange(assignment_id=old.id,snapshot_node_id=item.snapshot_node_id,
            operation_name=by_node[item.snapshot_node_id].operation_name or f'Операция {item.snapshot_node_id}',
            workshop_id=item.production_stage_id,workshop_name=workshops[item.production_stage_id],
            old_start=old.planned_date,old_end=old.planned_end_date,
            new_start=item.planned_start_date,new_end=item.planned_end_date,
            old_allocations=old_allocations,new_allocations=item.allocations,
            reason='selected_date' if item.snapshot_node_id==node.id else 'downstream_dependency')
        if item.snapshot_node_id==node.id: preview.selected_operation=change
        preview.affected_assignments.append(change)
    preview.new_eta=plan.planned_completion_date
    preview.new_slack=plan.buffer_days
    preview.risk_after=_risk(preview.new_eta,card.shipping_date)
    if plan.on_time is False:
        preview.capacity_warnings.append(issue('manual_replan_blocked',card.id,reason='deadline_missed').model_copy(
            update={'code':'manual_replan_shipping_risk','severity':'warning','message':'Новый план завершается после даты отгрузки.'}))
    preview.apply_allowed=True
    preview.preview_fingerprint=digest(preview.model_dump(mode='json'))
    return preview,replace_ids


def preview_replan(db: Session, request: ManualReplanRequest, *, today: date | None=None) -> ManualReplanPreview:
    repo.lock_scheduler(db)
    db.expire_all()
    with db.no_autoflush, localcontext() as context:
        context.prec=28
        current=today or planning_start_on(datetime.now(timezone.utc),platform_timezone_name(db))
        return _proposal(db,request,current)[0]


def apply_replan(db: Session, request: ManualReplanApply, *, actor, today: date | None=None) -> ManualReplanApplied:
    previous_actor=db.info.get('audit_actor')
    try:
        repo.lock_scheduler(db)
        db.expire_all()
        with db.no_autoflush,localcontext() as context:
            context.prec=28
            current=today or planning_start_on(datetime.now(timezone.utc),platform_timezone_name(db))
            preview,replace_ids=_proposal(db,request,current)
            if preview.preview_fingerprint!=request.preview_fingerprint:
                raise ManualReplanConflict(issue('manual_replan_changed',request.technical_card_id))
            if not preview.apply_allowed:
                raise ManualReplanConflict(preview.blockers[0])
            db.info['audit_actor']=actor
            persist_plan(db,preview.plan,replace_ids)
            selected=db.scalar(select(CalendarAssignment).where(CalendarAssignment.technical_card_id==request.technical_card_id,
                CalendarAssignment.stage_result_id==request.snapshot_node_id))
            selected.planning_mode='manual_adjusted'
            selected.manual_lock=True
            db.flush()
            event=append_audit_event(db,actor=actor,action='production_calendar.manual_route_replanned',
                entity_type='technical_card',entity_id=request.technical_card_id,source='manual_planning',
                payload={'selected_node':request.snapshot_node_id,'mode':request.mode,'revision':request.revision,
                    'preview_fingerprint':request.preview_fingerprint,
                    'affected_nodes':[c.snapshot_node_id for c in preview.affected_assignments],
                    'changes':[c.model_dump(mode='json') for c in preview.affected_assignments]})
            preview.plan.persisted=True
            card=repo.read_card(db,request.technical_card_id,False)
            response=ManualReplanApplied(preview=preview,planning_summary=read_persisted_plan(db,card),audit_event_id=event.id)
        db.commit()
        return response
    except ManualReplanConflict:
        db.rollback()
        raise
    except (TechnicalCardConflictError,IntegrityError) as error:
        db.rollback()
        raise ManualReplanConflict(issue('manual_replan_blocked',request.technical_card_id,reason=type(error).__name__)) from error
    except Exception:
        db.rollback()
        raise
    finally:
        if previous_actor is None:
            db.info.pop('audit_actor',None)
        else:
            db.info['audit_actor']=previous_actor
