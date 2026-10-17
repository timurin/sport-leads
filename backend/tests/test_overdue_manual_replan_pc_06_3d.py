from datetime import timedelta
import pytest
from sqlalchemy import select,func

from tests.test_production_scheduler_pc_04_3a import scheduler,TODAY,run
from tests.test_manual_route_replan_pc_06_3b import prepare,request,snapshot
from app.models.technical_card import TechnicalCard,TechnicalCardStageResult
from app.models.calendar_assignment import CalendarAssignment
from app.models.calendar_allocation import CalendarAllocation
from app.schemas.manual_route_replan import ManualReplanApply
from app.services import manual_route_replan as service
from app.services.production_state import resolve_fact_state
from app.services.production_calendar import board


def apply(db,payload,preview,today):
    return service.apply_replan(db,ManualReplanApply(**{**payload.model_dump(),'revision':preview.revision},
        preview_fingerprint=preview.preview_fingerprint),actor=None,today=today)


@pytest.mark.parametrize('offset',[-1,0,5],ids=['future','today','overdue'])
def test_pending_original_date_does_not_protect(scheduler,offset):
    factory,_=scheduler;prepare(factory)
    today=TODAY+timedelta(days=offset)
    with factory() as db:
        payload=request(db,days=8)
        before=snapshot(db)
        preview=service.preview_replan(db,payload,today=today)
        assert preview.apply_allowed
        assert snapshot(db)==before
        applied=apply(db,payload,preview,today)
        assert applied.planning_summary.is_current
        assert applied.planning_summary.planned_completion_date==payload.target_date
        assert snapshot(db)['technical_card_stage_results']==before['technical_card_stage_results']


def test_overdue_single_dependency_is_not_protected(scheduler):
    factory,_=scheduler;prepare(factory,third=True)
    with factory() as db:
        before=snapshot(db)
        preview=service.preview_replan(db,request(db,days=10),today=TODAY+timedelta(days=5))
        assert not preview.apply_allowed
        assert preview.blockers[0].code=='manual_replan_dependency'
        assert preview.blockers[0].message=='Перенос только этой операции нарушает последовательность маршрута. Используйте режим «Эту и последующие».'
        assert snapshot(db)==before


def test_overdue_downstream_moves_pending_and_preserves_fact_calendar_queue(scheduler):
    factory,_=scheduler;prepare(factory,third=True)
    today=TODAY+timedelta(days=5)
    with factory() as db:
        payload=request(db,'downstream',10)
        before=snapshot(db)
        fact=resolve_fact_state(db.get(TechnicalCard,1))
        preview=service.preview_replan(db,payload,today=today)
        assert preview.apply_allowed and len(preview.affected_assignments)==2
        applied=apply(db,payload,preview,today)
        assert applied.planning_summary.planned_completion_date==preview.new_eta
        assert resolve_fact_state(db.get(TechnicalCard,1))==fact
        after=snapshot(db)
        assert after['technical_cards']==before['technical_cards']
        assert after['technical_card_stage_results']==before['technical_card_stage_results']
        rows=board(db,today,today+timedelta(days=30),None).assignments
        assert any(row.snapshot_node_id==payload.snapshot_node_id and row.planned_date==payload.target_date for row in rows)
        orphan=db.scalar(select(func.count()).select_from(CalendarAllocation).outerjoin(CalendarAssignment,
            CalendarAllocation.assignment_id==CalendarAssignment.id).where(CalendarAssignment.id.is_(None)))
        assert orphan==0


@pytest.mark.parametrize('status',['in_progress','completed'])
def test_overdue_started_completed_remain_protected(scheduler,status):
    factory,_=scheduler;prepare(factory)
    with factory() as db:
        payload=request(db,days=10)
        db.get(TechnicalCardStageResult,payload.snapshot_node_id).status=status;db.commit()
        preview=service.preview_replan(db,payload,today=TODAY+timedelta(days=5))
        assert not preview.apply_allowed and preview.blockers[0].code=='manual_replan_protected'


def test_locked_overdue_assignment_is_protected(scheduler):
    factory,_=scheduler;prepare(factory)
    with factory() as db:
        payload=request(db,days=10)
        row=db.scalar(select(CalendarAssignment).where(CalendarAssignment.stage_result_id==payload.snapshot_node_id))
        row.planning_mode='locked';row.manual_lock=True;db.commit()
        preview=service.preview_replan(db,payload,today=TODAY+timedelta(days=5))
        assert not preview.apply_allowed and preview.blockers[0].code=='manual_replan_protected'


@pytest.mark.parametrize('future',[False,True])
def test_downstream_protected_anchor_has_concrete_node(scheduler,future):
    factory,_=scheduler;prepare(factory,third=True)
    with factory() as db:
        child=db.scalar(select(TechnicalCardStageResult).where(TechnicalCardStageResult.technical_card_id==1,
            TechnicalCardStageResult.stage_order==3))
        child.status='in_progress';db.commit()
        payload=request(db,'downstream',10)
        preview=service.preview_replan(db,payload,today=TODAY if future else TODAY+timedelta(days=5))
        assert not preview.apply_allowed and preview.blockers[0].code=='manual_replan_protected'
        assert preview.blockers[0].debug_details['snapshot_node_id']==child.id
        assert preview.blockers[0].debug_details['reason']=='downstream_protected'


def test_current_pending_without_fact_can_replan_but_regular_scheduler_still_protects_past(scheduler):
    factory,_=scheduler;prepare(factory)
    with factory() as db:
        payload=request(db,'downstream',10)
        root=db.scalar(select(TechnicalCardStageResult).where(TechnicalCardStageResult.technical_card_id==1,
            TechnicalCardStageResult.stage_order==1))
        payload.snapshot_node_id=root.id
        preview=service.preview_replan(db,payload,today=TODAY+timedelta(days=5))
        assert preview.apply_allowed
    # No exception input in ordinary Scheduler; existing past-plan anchor remains.
    from app.services.production_scheduler import schedule_card
    with factory() as db:
        before=snapshot(db)
        ordinary=schedule_card(db,1,persist=False,today=TODAY+timedelta(days=5))
        assert all(step.preserved for step in ordinary.steps)
        assert snapshot(db)==before
