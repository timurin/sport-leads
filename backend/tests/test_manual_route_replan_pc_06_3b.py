from datetime import timedelta
import pytest
from sqlalchemy import select,event

from tests.test_production_scheduler_pc_04_3a import scheduler,run,add_step,TODAY
from tests.test_queue_scheduler_concurrency_pc_04_4a import postgres_queue
from app.models.technical_card import TechnicalCard,TechnicalCardStageResult
from app.models.calendar_assignment import CalendarAssignment
from app.models.calendar_allocation import CalendarAllocation
from app.models.production_capacity import CapacityResource,TechOperationCapacityResource
from app.models.shop_routing import ShopRoutingStageLine
from app.models.audit import AuditEvent
from app.models.tech_operation import TechOperation
from app.schemas.manual_route_replan import ManualReplanRequest,ManualReplanApply
from app.services import manual_route_replan as service
from app.services.route_verification import record_applied_route
from app.services.route_snapshot import append_snapshot_line
from app.services.production_state import resolve_fact_state


def prepare(factory,third=False,parallel=False):
    add_step(factory)
    with factory() as db:
        db.get(TechOperation,2).production_stage_id=2
        db.get(ShopRoutingStageLine,2).production_stage_id=2
        db.add(CapacityResource(resource_key='packing',name='Packing',resource_type='throughput',
            capacity_unit='item',calculation_mode='rate',production_stage_id=2,base_rate=100,
            staff_count=1,hours_per_day=1,working_days=list(range(7)),shifts_per_day=1,efficiency=1))
        db.delete(db.get(TechOperationCapacityResource,(2,'items')))
        db.add(TechOperationCapacityResource(tech_operation_id=2,resource_key='packing'))
        if third:
            db.add(TechOperation(id=3,name='Final',code='final',volume_unit='pieces',production_stage_id=2))
            db.flush()
            line=ShopRoutingStageLine(id=3,routing_template_id=1,stage_order=3,stage_label='Packing',production_stage_id=2,tech_operation_id=3)
            db.add(line);db.flush()
            db.add(TechOperationCapacityResource(tech_operation_id=3,resource_key='packing'))
        for card in db.scalars(select(TechnicalCard)):
            for node in card.stage_results:
                if node.stage_order==2: node.production_stage_id=2
            if third: append_snapshot_line(db,card,line)
            if parallel:
                from app.models.technical_card import TechnicalCardRouteEdge
                ordered=sorted(card.stage_results,key=lambda node:node.stage_order)
                for successor in ordered[1:]:
                    db.add(TechnicalCardRouteEdge(technical_card_id=card.id,
                        predecessor_stage_result_id=ordered[0].id,successor_stage_result_id=successor.id))
            db.flush();record_applied_route(db,card)
        db.commit()
    assert run(factory).persisted


def request(db,mode='single',days=2):
    node=db.scalar(select(TechnicalCardStageResult).where(TechnicalCardStageResult.technical_card_id==1,
        TechnicalCardStageResult.stage_order==2))
    return ManualReplanRequest(technical_card_id=1,snapshot_node_id=node.id,target_date=TODAY+timedelta(days=days),mode=mode)


def apply(db,payload,preview):
    return service.apply_replan(db,ManualReplanApply(**{**payload.model_dump(),'revision':preview.revision},
        preview_fingerprint=preview.preview_fingerprint),actor=None,today=TODAY)


def snapshot(db):
    return {model.__tablename__:[service.columns(r) for r in db.scalars(select(model).order_by(model.id))]
        for model in (TechnicalCard,TechnicalCardStageResult,CalendarAssignment,CalendarAllocation,AuditEvent)}


def test_single_preview_read_only_apply_preserves_fact_and_consistent_eta(scheduler):
    factory,engine=scheduler
    prepare(factory)
    with factory() as db:
        payload=request(db)
        before=snapshot(db)
        fact=resolve_fact_state(db.get(TechnicalCard,1))
        writes=[]
        def observe(connection,cursor,sql,*args):
            if sql.lstrip().upper().startswith(('INSERT','UPDATE','DELETE')): writes.append(sql)
        event.listen(engine,'before_cursor_execute',observe)
        try: preview=service.preview_replan(db,payload,today=TODAY)
        finally: event.remove(engine,'before_cursor_execute',observe)
        assert preview.apply_allowed and not writes
        assert snapshot(db)==before
        assert preview.selected_operation.new_start==payload.target_date
        applied=apply(db,payload,preview)
        assert applied.audit_event_id and applied.planning_summary.planned_completion_date==preview.new_eta
        assert applied.planning_summary.is_current
        assert resolve_fact_state(db.get(TechnicalCard,1))==fact
        assert snapshot(db)['technical_card_stage_results']==before['technical_card_stage_results']
        assignments={r.id:r for r in db.scalars(select(CalendarAssignment))}
        for allocation in db.scalars(select(CalendarAllocation)):
            assert allocation.assignment_id in assignments
            assert assignments[allocation.assignment_id].planned_date<=allocation.date<=assignments[allocation.assignment_id].planned_end_date
        assert db.scalar(select(CalendarAssignment).where(CalendarAssignment.stage_result_id==payload.snapshot_node_id)).manual_lock
        with pytest.raises(service.ManualReplanConflict):apply(db,payload,preview)


def test_single_blocks_dependency_without_silent_cascade(scheduler):
    factory,_=scheduler;prepare(factory,third=True)
    with factory() as db:
        before=snapshot(db)
        preview=service.preview_replan(db,request(db,days=4),today=TODAY)
        assert not preview.apply_allowed
        assert preview.blockers[0].code=='manual_replan_dependency'
        assert snapshot(db)==before


def test_downstream_shifts_dependencies_and_updates_eta(scheduler):
    factory,_=scheduler;prepare(factory,third=True)
    with factory() as db:
        payload=request(db,'downstream',4)
        preview=service.preview_replan(db,payload,today=TODAY)
        assert preview.apply_allowed and len(preview.affected_assignments)==2
        assert preview.new_eta>preview.old_eta
        result=apply(db,payload,preview)
        assert result.planning_summary.planned_completion_date==preview.new_eta


@pytest.mark.parametrize('status',['in_progress','completed'])
def test_fact_cannot_move(scheduler,status):
    factory,_=scheduler;prepare(factory)
    with factory() as db:
        payload=request(db)
        db.get(TechnicalCardStageResult,payload.snapshot_node_id).status=status
        db.commit()
        preview=service.preview_replan(db,payload,today=TODAY)
        assert not preview.apply_allowed and preview.blockers[0].code=='manual_replan_protected'


def test_capacity_conflict_is_explicit(scheduler):
    factory,_=scheduler;prepare(factory)
    assert run(factory,2).persisted
    with factory() as db:
        payload=request(db,days=1)
        preview=service.preview_replan(db,payload,today=TODAY)
        assert not preview.apply_allowed
        assert preview.capacity_warnings and preview.blockers[0].code=='manual_replan_capacity'


def test_revision_checks_capacity_inputs_and_occupancy(scheduler):
    factory,_=scheduler;prepare(factory)
    with factory() as db:
        payload=request(db)
        preview=service.preview_replan(db,payload,today=TODAY)
    with factory() as db:
        db.get(CapacityResource,'packing').staff_count=2;db.commit()
    with factory() as db:
        with pytest.raises(service.ManualReplanConflict) as error:apply(db,payload,preview)
        assert error.value.diagnostic.code=='manual_replan_changed'


def test_failure_after_plan_writes_rolls_back_everything(scheduler,monkeypatch):
    factory,_=scheduler;prepare(factory)
    with factory() as db:
        payload=request(db);preview=service.preview_replan(db,payload,today=TODAY)
        before=snapshot(db)
        def fail(*args,**kwargs):raise RuntimeError('audit failure')
        monkeypatch.setattr(service,'append_audit_event',fail)
        with pytest.raises(RuntimeError):apply(db,payload,preview)
        assert snapshot(db)==before


def test_parallel_branch_retains_assignment_and_allocations(scheduler):
    factory,_=scheduler;prepare(factory,third=True,parallel=True)
    with factory() as db:
        other=db.scalar(select(TechnicalCardStageResult).where(TechnicalCardStageResult.technical_card_id==1,
            TechnicalCardStageResult.stage_order==3))
        saved=db.scalar(select(CalendarAssignment).where(CalendarAssignment.stage_result_id==other.id))
        before=service.columns(saved)
        allocations=[service.columns(a) for a in db.scalars(select(CalendarAllocation).where(CalendarAllocation.assignment_id==saved.id))]
        payload=request(db,'downstream',4)
        preview=service.preview_replan(db,payload,today=TODAY)
        assert preview.apply_allowed and len(preview.affected_assignments)==1
        apply(db,payload,preview)
        assert service.columns(db.get(CalendarAssignment,saved.id))==before
        assert [service.columns(a) for a in db.scalars(select(CalendarAllocation).where(CalendarAllocation.assignment_id==saved.id))]==allocations


def test_one_of_keeps_only_selected_members(scheduler):
    from tests.test_route_variants_pc_04_4i import seed_variant
    factory,_=scheduler
    nodes=seed_variant(factory)
    run(factory,3)
    with factory() as db:
        payload=ManualReplanRequest(technical_card_id=3,snapshot_node_id=int(nodes[3].split(':')[1]),
            target_date=TODAY+timedelta(days=4),mode='downstream')
        preview=service.preview_replan(db,payload,today=TODAY)
        assert preview.apply_allowed
        assert {step.snapshot_node_id for step in preview.plan.steps}=={int(nodes[i].split(':')[1]) for i in (1,3,5)}
        result=apply(db,payload,preview)
        assert result.planning_summary.is_current


def test_explicit_pending_manual_adjustment_can_be_moved_again(scheduler):
    factory,_=scheduler;prepare(factory)
    with factory() as db:
        payload=request(db)
        apply(db,payload,service.preview_replan(db,payload,today=TODAY))
        next_request=request(db,days=3)
        preview=service.preview_replan(db,next_request,today=TODAY)
        assert preview.apply_allowed
        apply(db,next_request,preview)


def test_api_contract_and_stale_409(scheduler,monkeypatch):
    from fastapi.testclient import TestClient
    from app.main import app
    from app.api.deps_auth import get_current_platform_user
    from app.database.session import get_db
    from app.models.auth import PlatformUser
    from app.models.rbac import Role,Permission
    from app.services.rbac import PERM_TECHNICAL_CARDS_CREATE
    factory,_=scheduler;prepare(factory)
    with factory() as db:
        payload=request(db).model_dump(mode='json')
        db.add(PlatformUser(id=90,login='manual-test',password_hash='unused',display_name='Manual test',is_active=True))
        db.commit()
    actor=PlatformUser(id=90,login='manual-test',roles=[Role(code='planner',name='Planner',permissions=[Permission(code=PERM_TECHNICAL_CARDS_CREATE)])])
    previous=dict(app.dependency_overrides)
    def database():
        with factory() as db:yield db
    app.dependency_overrides[get_db]=database
    app.dependency_overrides[get_current_platform_user]=lambda:actor
    monkeypatch.setattr(service,'planning_start_on',lambda *args:TODAY)
    try:
        with TestClient(app) as client:
            preview=client.post('/production-calendar/manual-planning/preview',json=payload)
            assert preview.status_code==200,preview.text
            body={**payload,'revision':preview.json()['revision'],'preview_fingerprint':preview.json()['preview_fingerprint']}
            applied=client.post('/production-calendar/manual-planning/apply',json=body)
            assert applied.status_code==200,applied.text
            stale=client.post('/production-calendar/manual-planning/apply',json=body)
            assert stale.status_code==409 and stale.headers['X-Diagnostic-Code']=='manual_replan_changed'
            actor.roles=[]
            assert client.post('/production-calendar/manual-planning/preview',json=payload).status_code==403
            app.dependency_overrides.pop(get_current_platform_user)
            assert client.post('/production-calendar/manual-planning/preview',json=payload).status_code==401
    finally:
        app.dependency_overrides.clear();app.dependency_overrides.update(previous)


def test_concurrent_apply_one_revision_wins(postgres_queue):
    from concurrent.futures import ThreadPoolExecutor
    from threading import Barrier
    from sqlalchemy import text
    factory=postgres_queue
    with factory() as db:
        db.execute(text("SELECT setval(pg_get_serial_sequence('technical_card_stage_results','id'),(SELECT max(id) FROM technical_card_stage_results),true)"))
        db.commit()
    prepare(factory)
    with factory() as db:
        payload=request(db)
        preview=service.preview_replan(db,payload,today=TODAY)
    barrier=Barrier(2)
    def command():
        with factory() as db:
            barrier.wait(timeout=15)
            try:
                apply(db,payload,preview)
                return 'applied'
            except service.ManualReplanConflict as error:
                return error.diagnostic.code
    with ThreadPoolExecutor(max_workers=2) as pool:
        futures=[pool.submit(command) for _ in range(2)]
        results=[future.result(timeout=30) for future in futures]
    assert sorted(results)==['applied','manual_replan_changed']
