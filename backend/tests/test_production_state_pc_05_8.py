from datetime import timedelta

from sqlalchemy import event, select

from tests.test_production_scheduler_pc_04_3a import scheduler, run, TODAY
from app.models.technical_card import TechnicalCard
from app.models.calendar_assignment import CalendarAssignment
from app.services.production_state import load_states, resolve_fact_state
from app.services.production_calendar import board
from app.services.workshop_queue import read_workshop_queue
from app.services.technical_cards import list_technical_cards, to_technical_card_list_read


def test_planned_list_calendar_queue_share_state_without_writes(scheduler):
    factory, engine = scheduler
    run(factory)
    statements = []
    def track(connection, cursor, statement, *args):
        statements.append(statement.strip().split()[0].upper())
    event.listen(engine, "before_cursor_execute", track)
    try:
        with factory() as db:
            rows = list_technical_cards(db, status="planned")
            assert [row[0].id for row in rows] == [1]
            card = rows[0][0]
            state = to_technical_card_list_read(card).production_state
            assert state.lifecycle_status == "planned"
            assert state.workshop_state == "waiting"
            assert card.status == "draft"
            assignments = board(db, TODAY, TODAY + timedelta(days=20), None).assignments
            for assignment in assignments:
                if assignment.technical_card_id == 1:
                    assert assignment.production_state == state
                    node_id = db.get(CalendarAssignment, assignment.id).stage_result_id
                    assert assignment.operation_state == ("current" if node_id in state.current_snapshot_nodes else "future")
            queue = read_workshop_queue(db, 1, today=TODAY)
            assert 1 in {item.technical_card_id for item in queue.items}
            assert all(item.workshop_id == state.current_workshop_id for item in queue.items)
        assert not {"INSERT", "UPDATE", "DELETE"}.intersection(statements)
    finally:
        event.remove(engine, "before_cursor_execute", track)


def test_stale_plan_cannot_promote_draft_or_move_fact(scheduler):
    factory, _ = scheduler
    run(factory)
    with factory() as db:
        card = db.get(TechnicalCard, 1)
        card.quantity = 101
        state = load_states(db, [card])[1]
        assert state.lifecycle_status == "draft"
        assert state.planning_state in {"stale", "invalid"}
        assert state.current_workshop_id == 1
        card.stage_results[0].status = "in_progress"
        state = load_states(db, [card])[1]
        assert state.lifecycle_status == "in_progress"
        assert state.workshop_state == "in_progress"


def test_state_batch_query_count_does_not_grow_per_card(scheduler):
    factory, engine = scheduler
    run(factory)
    run(factory, card=2)
    def count(ids):
        queries = []
        def track(connection, cursor, statement, *args):
            queries.append(statement)
        with factory() as db:
            cards = list(db.scalars(select(TechnicalCard).where(TechnicalCard.id.in_(ids))))
            event.listen(engine, "before_cursor_execute", track)
            try:
                states = load_states(db, cards)
                assert all(state.lifecycle_status == "planned" for state in states.values())
            finally:
                event.remove(engine, "before_cursor_execute", track)
        return len(queries)
    assert count([1]) == count([1, 2])


def test_required_completion_clears_current_workshop(scheduler):
    factory, _ = scheduler
    with factory() as db:
        card = db.get(TechnicalCard, 1)
        card.stage_results[0].status = "completed"
        state = resolve_fact_state(card)
        assert state.lifecycle_status == "completed"
        assert state.current_workshop_id is None
        assert state.current_stage_order is None


def test_terminal_fact_and_cancelled_state_are_not_overridden_by_route_readiness(scheduler):
    factory, _ = scheduler
    with factory() as db:
        card = db.get(TechnicalCard, 1)
        card.routing_template_id = None  # retained facts with an unverified route
        card.stage_results[0].status = "completed"
        state = load_states(db, [card])[1]
        assert state.lifecycle_status == "completed"
        assert state.current_workshop_id is None
        card.stage_results[0].status = "pending"
        card.status = "cancelled"
        state = load_states(db, [card])[1]
        assert state.lifecycle_status == "cancelled"
        assert state.current_workshop_id is None
