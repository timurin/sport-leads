"""BUG-01: distinguish the create-form order date from card shipping date."""

from datetime import timedelta

import pytest
from sqlalchemy import event

from tests.test_scheduler_prerequisites_pc_04_1 import planner
from tests.test_production_scheduler_pc_04_3a import scheduler, run, TODAY
from tests.test_manual_route_replan_pc_06_3b import snapshot
from app.models.technical_card import TechnicalCard
from app.schemas.technical_card import TechnicalCardPlanningUpdate
from app.services.technical_card_planning import update_technical_card_planning
from app.services.persisted_plan import read_persisted_plan
from app.services.planning_health import load_planning_health
from app.services.production_calendar import board
from app.services.calendar_plan_linkage import PlanLinkageConflict
from app.models.sales import Client, SalesOrder, SalesOrderItem


@pytest.mark.parametrize('explicit_shipping', [False, True])
def test_post_reload_and_patch_reload_match_planning_health(planner, explicit_shipping):
    client, _, _ = planner
    payload = dict(nomenclature_name='BUG-01', order_number='BUG-01',
                   tech_cards_planned_count=1, desired_date='2026-11-20')
    if explicit_shipping:
        payload['shipping_date'] = '2026-11-21'
    created = client.post('/technical-cards/standalone', json=payload)
    assert created.status_code == 201, created.text
    card_id = created.json()['id']
    expected = payload.get('shipping_date')
    for shipping in [expected, '2026-11-25', None]:
        if shipping != expected or shipping is None:
            patched = client.patch(f'/technical-cards/{card_id}/planning', json={'shipping_date': shipping})
            assert patched.status_code == 200, patched.text
        detail = client.get(f'/technical-cards/{card_id}')
        health = client.get(f'/technical-cards/{card_id}/planning-health')
        assert detail.status_code == health.status_code == 200
        assert detail.json()['desired_date'] == '2026-11-20'
        assert detail.json()['shipping_date'] == shipping
        assert detail.json()['planning_summary']['shipping_date'] == shipping
        assert health.json()['shipping_date'] == shipping
        assert health.json()['eta'] is None
    for invalid in ['', '2026-02-30', 'not-a-date']:
        assert client.patch(f'/technical-cards/{card_id}/planning', json={'shipping_date': invalid}).status_code == 422
        assert client.post('/technical-cards/standalone', json={**payload, 'shipping_date': invalid}).status_code == 422


@pytest.mark.parametrize('linked', [False, True])
def test_shipping_edit_preserves_protected_plan_fact_and_get_is_read_only(scheduler, linked):
    factory, engine = scheduler
    saved = run(factory)
    with factory() as db:
        card = db.get(TechnicalCard, 1)
        if linked:
            client = Client(contact_name='BUG-01')
            db.add(client)
            db.flush()
            order = SalesOrder(number='BUG-01', client_id=client.id, title='BUG-01')
            db.add(order)
            db.flush()
            item = SalesOrderItem(order_id=order.id, position=1, snapshot_name='BUG-01', quantity=100, unit_price=0, discount_amount=0, line_amount=0)
            db.add(item)
            db.flush()
            card.sales_order_id, card.sales_order_item_id = order.id, item.id
            card.order_group_id = None
        db.commit()
    for days in [-1, 3]:
        with factory() as db:
            before = snapshot(db)
            update_technical_card_planning(db, 1, TechnicalCardPlanningUpdate(shipping_date=TODAY + timedelta(days=days)))
            db.commit()
            after = snapshot(db)
            assert {k:v for k,v in before.items() if k != 'technical_cards'} == {k:v for k,v in after.items() if k != 'technical_cards'}
        writes = []
        def observe(conn, cursor, sql, *args):
            if sql.lstrip().upper().startswith(('INSERT', 'UPDATE', 'DELETE')):
                writes.append(sql)
        event.listen(engine, 'before_cursor_execute', observe)
        try:
            with factory() as db:
                card = db.get(TechnicalCard, 1)
                summary = read_persisted_plan(db, card)
                health = load_planning_health(db, [card], today=TODAY)[1]
                assert summary.shipping_date == health.shipping_date == TODAY + timedelta(days=days)
                assert summary.planned_completion_date == health.eta == saved.planned_completion_date
                assert summary.buffer_days == health.slack_days == days
                assert health.risk_level == ('late' if days < 0 else 'on_time')
                rows = board(db, TODAY, TODAY + timedelta(days=7), None).assignments
                assert bool(rows) == (not linked)  # Calendar scope is standalone.
                assert snapshot(db) == after
            assert writes == []
        finally:
            event.remove(engine, 'before_cursor_execute', observe)
    with factory() as db:
        card = db.get(TechnicalCard, 1)
        card.plan_locked = True
        card.stage_results[0].status = 'in_progress'
        db.commit()
        before = snapshot(db)
        with pytest.raises(PlanLinkageConflict):
            update_technical_card_planning(db, 1, TechnicalCardPlanningUpdate(shipping_date=TODAY))
        db.rollback()
        assert snapshot(db) == before
