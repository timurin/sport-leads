"""Real local PostgreSQL concurrency; only a UUID-owned schema is mutated."""
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from uuid import uuid4

import pytest
from sqlalchemy import create_engine, event, func, select, text
from sqlalchemy.engine import make_url
from sqlalchemy.orm import sessionmaker

from tests.test_production_scheduler_pc_04_3a import TODAY, scheduler
from app.config.settings import settings
from app.database.base import Base
from app.models.calendar_assignment import CalendarAssignment
from app.models.calendar_allocation import CalendarAllocation
from app.models.technical_card import TechnicalCard
from app.services.production_queue_scheduler import schedule_queue
from app.services.production_scheduler import schedule_card


@pytest.fixture
def postgres_queue(scheduler):
    url = make_url(settings.database_url)
    if url.host not in {"localhost", "127.0.0.1"} or (url.port or 5432) != 5432:
        pytest.skip("Only canonical local PostgreSQL :5432 is allowed")
    schema = "queue_scheduler_test_" + uuid4().hex
    admin = create_engine(settings.database_url)
    engine = None
    try:
        with admin.begin() as connection:
            connection.execute(text("CREATE SCHEMA " + schema))
        engine = create_engine(settings.database_url)
        @event.listens_for(engine, "connect")
        def search_path(connection, _):
            with connection.cursor() as cursor:
                cursor.execute("SET search_path TO " + schema)
            connection.commit()
        Base.metadata.create_all(engine)
        factory = sessionmaker(bind=engine, expire_on_commit=False)
        sqlite_factory, _ = scheduler
        # Copy only this test's isolated fixture rows in metadata dependency order.
        with sqlite_factory() as source, engine.begin() as target:
            for table in Base.metadata.sorted_tables:
                rows = [dict(row) for row in source.execute(select(table)).mappings()]
                if rows:
                    target.execute(table.insert(), rows)
            # Explicit test fixture ids did not advance PostgreSQL sequences.
            target.execute(text("SELECT setval(pg_get_serial_sequence('calendar_assignments', 'id'), 10, true)"))
            target.execute(text("SELECT setval(pg_get_serial_sequence('audit_events', 'id'), (SELECT max(id) FROM audit_events), true)"))
        yield factory
    finally:
        if engine is not None:
            engine.dispose()
        assert schema.startswith("queue_scheduler_test_") and len(schema.removeprefix("queue_scheduler_test_")) == 32
        with admin.begin() as connection:
            connection.execute(text("DROP SCHEMA IF EXISTS " + schema + " CASCADE"))
        admin.dispose()


@pytest.mark.parametrize("commands", [("mass", "mass"), ("mass", "single")])
def test_concurrent_commands_preserve_shared_capacity(postgres_queue, commands):
    barrier = Barrier(2)
    def command(kind):
        with postgres_queue() as db:
            barrier.wait(timeout=15)
            return schedule_queue(db, today=TODAY) if kind == "mass" else schedule_card(db, 1, today=TODAY)
    with ThreadPoolExecutor(max_workers=2) as pool:
        futures = [pool.submit(command, kind) for kind in commands]
        results = [future.result(timeout=30) for future in futures]
    assert all(result.status == "planned" for result in results)
    with postgres_queue() as db:
        allocations = list(db.scalars(select(CalendarAllocation)))
        assert len(allocations) == 2
        totals = db.execute(select(CalendarAllocation.date, func.sum(CalendarAllocation.allocated_amount)).group_by(CalendarAllocation.date)).all()
        assert len(totals) == 2 and all(amount == 100 for _, amount in totals)
        assignments = list(db.scalars(select(CalendarAssignment).where(CalendarAssignment.routing_stage_line_id.is_not(None))))
        assert len(assignments) == len({(row.technical_card_id, row.routing_stage_line_id) for row in assignments}) == 2


def test_postgres_queue_failure_keeps_original_rows(postgres_queue):
    with postgres_queue() as db:
        schedule_queue(db, today=TODAY)
    with postgres_queue() as db:
        before = [(row.id, row.assignment_id, row.date, row.allocated_amount) for row in db.scalars(select(CalendarAllocation).order_by(CalendarAllocation.id))]
        db.get(TechnicalCard, 1).priority = 20
        db.get(TechnicalCard, 2).priority = 10
        db.commit()
    engine = postgres_queue.kw["bind"]
    inserted = 0
    def fail(_, __, sql, ___, ____, _____):
        nonlocal inserted
        if sql.startswith("INSERT INTO calendar_allocations"):
            inserted += 1
            if inserted == 2:
                raise RuntimeError("Injected queue persistence failure")
    event.listen(engine, "before_cursor_execute", fail)
    try:
        with postgres_queue() as db, pytest.raises(RuntimeError, match="Injected"):
            schedule_queue(db, today=TODAY)
    finally:
        event.remove(engine, "before_cursor_execute", fail)
    with postgres_queue() as db:
        assert [(row.id, row.assignment_id, row.date, row.allocated_amount) for row in db.scalars(select(CalendarAllocation).order_by(CalendarAllocation.id))] == before


def test_postgres_replay_respects_blocked_old_plan(postgres_queue):
    with postgres_queue() as db:
        saved = schedule_card(db, 2, today=TODAY)
    with postgres_queue() as db:
        db.get(TechnicalCard, 1).priority = 1
        card = db.get(TechnicalCard, 2)
        card.priority, card.routing_template_id = 100, None
        db.commit()
        result = schedule_queue(db, today=TODAY)
        assert result.status == "partial" and result.planned_cards == 1
    with postgres_queue() as db:
        assert db.get(CalendarAssignment, saved.steps[0].assignment_id).technical_card_id == 2
        amounts = db.execute(select(CalendarAllocation.date, func.sum(CalendarAllocation.allocated_amount)).group_by(CalendarAllocation.date)).all()
        assert len(amounts) == 2 and all(amount == 100 for _, amount in amounts)
