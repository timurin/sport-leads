"""Actual PostgreSQL revision serialization and reversible migration, UUID-owned schemas."""
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from uuid import uuid4

from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import select, text

from tests.test_production_scheduler_pc_04_3a import TODAY, scheduler
from tests.test_queue_scheduler_concurrency_pc_04_4a import postgres_queue
from tests.test_route_snapshot_migration_pc_04_4g import engine_or_skip, migration
from tests.test_workshop_queue_pc_05_6c import prepare, request, apply
from app.models.calendar_allocation import CalendarAllocation
from app.models.calendar_assignment import CalendarAssignment
from app.services import workshop_queue as queue


def test_concurrent_apply_only_one_revision_wins(postgres_queue):
    factory = postgres_queue
    prepare(factory)
    with factory() as db:
        payload = request(db)
        preview = queue.preview_workshop_queue(db, 1, payload, today=TODAY)
    barrier = Barrier(2)
    def command(_):
        with factory() as db:
            barrier.wait(timeout=15)
            try:
                apply(db, payload, preview)
                return 'applied'
            except queue.WorkshopQueueConflict as error:
                return error.diagnostic.code
    with ThreadPoolExecutor(max_workers=2) as pool:
        futures = [pool.submit(command, index) for index in range(2)]
        results = [future.result(timeout=30) for future in futures]
    assert sorted(results) == ['applied', 'workshop_queue_changed']
    with factory() as db:
        assert [item.snapshot_node_id for item in queue.read_workshop_queue(db, 1, today=TODAY).items] == payload.ordered_snapshot_node_ids
        assignments = {row.id: row for row in db.scalars(select(CalendarAssignment))}
        for allocation in db.scalars(select(CalendarAllocation)):
            assert allocation.assignment_id in assignments


def test_queue_position_migration_reversible_preserves_existing_rows():
    engine = engine_or_skip()
    schema = 'queue_migration_test_' + uuid4().hex
    module = migration('f2a3b4c5d678_workshop_queue_position.py')
    try:
        with engine.begin() as conn:
            conn.execute(text('CREATE SCHEMA ' + schema))
            conn.execute(text('SET LOCAL search_path TO ' + schema))
            conn.execute(text('CREATE TABLE calendar_assignments (id integer PRIMARY KEY, position integer NOT NULL, note text)'))
            conn.execute(text("INSERT INTO calendar_assignments VALUES (1,7,'retained plan')"))
            with Operations.context(MigrationContext.configure(conn)):
                module.upgrade()
                assert conn.execute(text('SELECT queue_position FROM calendar_assignments')).scalar() is None
                conn.execute(text('UPDATE calendar_assignments SET queue_position=3'))
                module.downgrade()
                assert conn.execute(text('SELECT id,position,note FROM calendar_assignments')).one() == (1,7,'retained plan')
                module.upgrade()
                assert conn.execute(text('SELECT queue_position FROM calendar_assignments')).scalar() is None
    finally:
        assert schema.startswith('queue_migration_test_') and len(schema.removeprefix('queue_migration_test_')) == 32
        with engine.begin() as conn:
            conn.execute(text('DROP SCHEMA IF EXISTS ' + schema + ' CASCADE'))
        engine.dispose()
