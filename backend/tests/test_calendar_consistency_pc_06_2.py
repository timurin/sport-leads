from datetime import timedelta

from sqlalchemy import event, select
from tests.test_production_scheduler_pc_04_3a import scheduler, run, add_step, TODAY
from app.models.technical_card import TechnicalCard, TechnicalCardStageResult
from app.models.production_capacity import CapacityResource, TechOperationCapacityResource
from app.models.shop_routing import ShopRoutingStageLine
from app.models.tech_operation import TechOperation
from app.services.technical_card_stages import start_stage
from app.services.production_calendar import board
from app.services.persisted_plan import read_persisted_plan
from app.services.technical_cards import get_technical_card, to_technical_card_read


def test_same_workshop_nodes_keep_their_own_status_and_future_visibility(scheduler):
    factory, _ = scheduler
    add_step(factory)
    run(factory)
    with factory() as db:
        start_stage(db, 1, 1)
    with factory() as db:
        rows = board(db, TODAY, TODAY+timedelta(days=7), 1).assignments
        assert len(rows) == 2
        assert [row.operation_status for row in rows] == ['in_progress','pending']
        assert len({row.snapshot_node_id for row in rows}) == 2
        assert all(row.production_state.workshop_state == 'in_progress' for row in rows)
        # Temporal placement and operation fact are independent: second pending
        # node shares the current workshop but must not inherit its started fact.
        assert rows[1].operation_status != rows[0].operation_status


def test_future_workshop_is_present_without_moving_current_workshop(scheduler):
    factory, _ = scheduler
    add_step(factory)
    from app.services.route_verification import record_applied_route
    with factory() as db:
        db.get(TechOperation,2).production_stage_id=2
        db.get(ShopRoutingStageLine,2).production_stage_id=2
        db.add(CapacityResource(resource_key="packing",name="Packing",resource_type="throughput",
            capacity_unit="item",calculation_mode="rate",production_stage_id=2,base_rate=100,
            staff_count=1,hours_per_day=1,working_days=list(range(7)),shifts_per_day=1,efficiency=1))
        old=db.get(TechOperationCapacityResource,(2,'items'))
        db.delete(old)
        db.add(TechOperationCapacityResource(tech_operation_id=2,resource_key='packing'))
        for card in db.scalars(select(TechnicalCard)):
            for node in card.stage_results:
                if node.stage_order==2:
                    node.production_stage_id=2
            db.flush()
            record_applied_route(db,card)
        db.commit()
    run(factory)
    with factory() as db:
        rows = board(db,TODAY,TODAY+timedelta(days=7),None).assignments
        future=next(row for row in rows if row.production_stage_id==2)
        assert future.operation_state=='future' and future.operation_status=='pending'
        assert future.production_state.current_workshop_id==1


def test_persisted_eta_survives_new_session_and_stale_is_explicit(scheduler):
    factory, engine = scheduler
    add_step(factory)
    saved = run(factory)
    with factory() as db:
        db.get(TechnicalCard,1).qr_token="pc062-established-qr-token"
        db.commit()
    statements=[]
    def observe(connection,cursor,sql,*args):
        if sql.lstrip().upper().startswith(('INSERT','UPDATE','DELETE')):
            statements.append(sql)
    event.listen(engine,'before_cursor_execute',observe)
    try:
        with factory() as db:
            card = get_technical_card(db,1)
            summary = read_persisted_plan(db,card)
            assert summary.persisted and summary.is_current and not summary.replan_required
            assert summary.planned_start_date == TODAY
            assert summary.planned_completion_date == saved.planned_completion_date
            assert summary.shipping_date == card.shipping_date
            assert summary.buffer_days == saved.buffer_days
            dto = to_technical_card_read(db,card)
            assert dto.planning_summary == summary
        assert not statements
    finally:
        event.remove(engine,'before_cursor_execute',observe)
    with factory() as db:
        db.get(CapacityResource,'items').staff_count = 2
        db.commit()
    with factory() as db:
        summary=read_persisted_plan(db,get_technical_card(db,1))
        assert summary.planned_completion_date == saved.planned_completion_date
        assert summary.planning_state == 'stale'
        assert summary.replan_required and not summary.is_current


def test_no_saved_plan_does_not_invent_eta(scheduler):
    factory,_=scheduler
    with factory() as db:
        summary=read_persisted_plan(db,get_technical_card(db,1))
        assert not summary.persisted and not summary.is_current
        assert summary.planned_completion_date is None


def test_seven_short_sequential_operations_can_share_an_inclusive_day(scheduler):
    from app.services.route_snapshot import append_snapshot_line
    factory,_=scheduler
    add_step(factory)
    with factory() as db:
        card=db.get(TechnicalCard,1)
        card.quantity=10
        for index in range(3,8):
            db.add(TechOperation(id=index,name=f'Op {index}',code=f'op_{index}',volume_unit='pieces',production_stage_id=1))
            db.flush()
            line=ShopRoutingStageLine(id=index,routing_template_id=1,stage_order=index,stage_label='Production',production_stage_id=1,tech_operation_id=index)
            db.add(line)
            db.flush()
            db.add(TechOperationCapacityResource(tech_operation_id=index,resource_key='items'))
            append_snapshot_line(db,card,line)
        db.commit()
    result=run(factory)
    assert result.persisted and len(result.steps)==7
    assert all(step.planned_start_date==step.planned_end_date==TODAY for step in result.steps)
    assert sum(allocation.allocated_amount for step in result.steps for allocation in step.allocations)==70
    assert all(after.planned_start_date>=before.planned_end_date for before,after in zip(result.steps,result.steps[1:]))
