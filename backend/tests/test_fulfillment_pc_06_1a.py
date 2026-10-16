from copy import deepcopy

import pytest
from sqlalchemy import select, func, event

from tests.test_production_scheduler_pc_04_3a import scheduler, run
from tests.test_technical_card_readiness_pc_06_0a import prepare
from app.models.technical_card import TechnicalCard, TechnicalCardStageResult
from app.models.production_stage import ProductionStage
from app.models.stock import StockDocument, StockLedgerLine
from app.models.calendar_assignment import CalendarAssignment
from app.models.audit import AuditEvent
from app.services.technical_card_stages import complete_stage, rollback_stage, rollback_stage_for_shop_kanban
from app.services.technical_card_fulfillment import list_fulfillment, mark_shipped
from app.services.technical_cards import TechnicalCardConflictError, list_technical_cards
from app.services.production_state import resolve_fact_state
from app.services.technical_card_fact_projection import fact_integrity_issues


def records(db, rows):
    return [{column.name: deepcopy(getattr(row, column.name)) for column in row.__table__.columns} for row in rows]


def preserved(db, card):
    return dict(quantity=str(card.quantity), stages=records(db, card.stage_results),
        units=records(db, card.unit_lines), materials=records(db, card.composition_lines),
        edges=records(db, card.route_edges), operations=records(db, card.operation_lines),
        calendar=records(db, db.scalars(select(CalendarAssignment).where(CalendarAssignment.technical_card_id == card.id))),
        stock=db.scalar(select(func.count()).select_from(StockDocument)),
        ledger=db.scalar(select(func.count()).select_from(StockLedgerLine)))


def test_completion_shipping_preserves_production_and_warehouse(scheduler):
    factory, engine = scheduler
    prepare(factory)
    run(factory)
    with factory() as db:
        card = db.get(TechnicalCard, 1)
        assert card.fulfillment_status is None
        assert not list_fulfillment(db, "ready_to_ship")
        with pytest.raises(TechnicalCardConflictError, match="ещё не завершено"):
            mark_shipped(db, 1, actor=None)
        db.rollback()
        complete_stage(db, 1, 1)
        card = db.get(TechnicalCard, 1)
        assert card.status == "completed" and card.fulfillment_status == "ready_to_ship"
        assert card.ready_to_ship_at and card.shipped_at is None
        assert resolve_fact_state(card).current_workshop_id is None
        assert [row.id for row in list_fulfillment(db, "ready_to_ship")] == [1]
        assert not list_technical_cards(db, stage="Производство")
        db.expire_all()  # SQLite reload normalizes timestamp representation.
        before = preserved(db, card)
        ready_at = card.ready_to_ship_at
        mark_shipped(db, 1, actor=None)
        assert card.fulfillment_status == "shipped" and card.shipped_at
        assert card.ready_to_ship_at == ready_at
        assert preserved(db, card) == before
        assert not list_fulfillment(db, "ready_to_ship")
        assert [row.id for row in list_fulfillment(db, "shipped")] == [1]
        audit_count = db.scalar(select(func.count()).select_from(AuditEvent))
        for action in (lambda: mark_shipped(db, 1, actor=None), lambda: rollback_stage(db, 1, 1),
                       lambda: rollback_stage_for_shop_kanban(db, 1, 1)):
            with pytest.raises(TechnicalCardConflictError, match="уже отгружена"):
                action()
            db.rollback()
        assert db.scalar(select(func.count()).select_from(AuditEvent)) == audit_count
        assert preserved(db, card) == before
        assert not fact_integrity_issues(card)
        events = db.scalars(select(AuditEvent).where(AuditEvent.action.like("fulfillment.%"))).all()
        assert {row.action for row in events} == {"fulfillment.ready_to_ship", "fulfillment.shipped"}
        assert all(row.payload["warehouse_integration"] == "deferred" for row in events)


def test_legacy_markers_retained_without_blocking_production(scheduler):
    factory, _ = scheduler
    prepare(factory)
    run(factory)
    with factory() as db:
        for index, code in enumerate(("ready_to_ship", "shipped"), 10):
            db.add(ProductionStage(id=index, code=code, name=code, sort_order=index, is_active=True))
            db.add(TechnicalCardStageResult(technical_card_id=1, stage_order=index,
                production_stage_id=index, stage_label=code, is_required=True, status="pending"))
        db.commit()
        from app.services.route_verification import record_applied_route
        record_applied_route(db, db.get(TechnicalCard, 1))
        db.commit()
        complete_stage(db, 1, 1)
        card = db.get(TechnicalCard, 1)
        assert resolve_fact_state(card).lifecycle_status == "completed"
        assert card.fulfillment_status == "ready_to_ship"
        assert [row.status for row in card.stage_results if row.tech_operation_id is None] == ["pending", "pending"]
        assert db.scalar(select(func.count()).select_from(StockDocument)) == 0


def test_fulfillment_read_is_slim_single_query_no_writes(scheduler):
    factory, engine = scheduler
    prepare(factory)
    run(factory)
    with factory() as db:
        complete_stage(db, 1, 1)
        statements = []
        def observe(connection, cursor, sql, *args):
            statements.append(sql)
        event.listen(engine, "before_cursor_execute", observe)
        try:
            rows = list_fulfillment(db, "ready_to_ship")
            assert len(rows) == 1 and rows[0].quantity == 4
            assert "stage_results" not in rows[0].model_dump()
            assert len(statements) == 1 and statements[0].lstrip().upper().startswith("SELECT")
        finally:
            event.remove(engine, "before_cursor_execute", observe)


def test_ready_reopen_clears_fulfillment_but_shipped_does_not_reopen(scheduler):
    factory, _ = scheduler
    prepare(factory)
    run(factory)
    with factory() as db:
        complete_stage(db, 1, 1)
        rollback_stage(db, 1, 1)
        card = db.get(TechnicalCard, 1)
        assert card.status == "in_progress" and card.fulfillment_status is None
        assert card.ready_to_ship_at is None and card.shipped_at is None
        assert not list_fulfillment(db, "ready_to_ship")


def test_api_auth_permissions_lists_and_duplicate(scheduler):
    from fastapi.testclient import TestClient
    from app.main import app
    from app.database.session import get_db
    from tests.auth_test_helpers import ensure_user_with_role, login_client
    factory, _ = scheduler
    prepare(factory)
    run(factory)
    with factory() as db:
        complete_stage(db, 1, 1)
        ensure_user_with_role(db, login="fulfillment_ops", role_code="shop_operator")
    def database():
        with factory() as db:
            yield db
    app.dependency_overrides[get_db] = database
    try:
        with TestClient(app) as client:
            assert client.post('/technical-cards/1/mark-shipped').status_code == 401
            assert client.get('/technical-cards/fulfillment/ready_to_ship').status_code == 401
            login_client(client, login="fulfillment_ops")
            ready = client.get('/technical-cards/fulfillment/ready_to_ship')
            assert ready.status_code == 200 and ready.json()[0]['id'] == 1
            assert client.post('/technical-cards/1/mark-shipped').status_code == 200
            assert client.get('/technical-cards/fulfillment/ready_to_ship').json() == []
            shipped = client.get('/technical-cards/fulfillment/shipped')
            assert shipped.status_code == 200 and shipped.json()[0]['id'] == 1
            assert client.post('/technical-cards/1/mark-shipped').status_code == 409
            assert client.get('/technical-cards/fulfillment/unknown').status_code == 422
    finally:
        app.dependency_overrides.pop(get_db, None)


def test_future_hook_failure_rolls_back_transition_and_audit(scheduler, monkeypatch):
    from app.services import technical_card_fulfillment as fulfillment
    factory, _ = scheduler
    prepare(factory)
    run(factory)
    with factory() as db:
        complete_stage(db, 1, 1)
        count = db.scalar(select(func.count()).select_from(AuditEvent))
        def fail(*args):
            raise RuntimeError("warehouse hook unavailable")
        monkeypatch.setattr(fulfillment, "on_shipped", fail)
        with pytest.raises(RuntimeError):
            mark_shipped(db, 1, actor=None)
        db.rollback()
        card = db.get(TechnicalCard, 1)
        assert card.fulfillment_status == "ready_to_ship" and card.shipped_at is None
        assert db.scalar(select(func.count()).select_from(AuditEvent)) == count


def test_fulfillment_mismatch_is_diagnosed_without_repair(scheduler):
    factory, _ = scheduler
    prepare(factory)
    run(factory)
    with factory() as db:
        complete_stage(db, 1, 1)
        card = db.get(TechnicalCard, 1)
        card.fulfillment_status = None
        card.ready_to_ship_at = None
        db.commit()
        assert any(issue.code == "production_fulfillment_mismatch" for issue in fact_integrity_issues(card))
        assert card.fulfillment_status is None


def test_fulfillment_migration_reversible():
    from uuid import uuid4
    from sqlalchemy import text
    from alembic.migration import MigrationContext
    from alembic.operations import Operations
    from tests.test_route_snapshot_migration_pc_04_4g import engine_or_skip, migration
    engine = engine_or_skip()
    schema = 'fulfillment_test_' + uuid4().hex
    module = migration('i5j6k7l8m912_technical_card_fulfillment.py')
    try:
        with engine.begin() as conn:
            conn.execute(text('CREATE SCHEMA ' + schema))
            conn.execute(text('SET LOCAL search_path TO ' + schema))
            conn.execute(text('CREATE TABLE technical_cards(id integer PRIMARY KEY,status text,route_variant_groups json,route_variant_selections json,current_stage_order integer,current_stage_label text)'))
            conn.execute(text('CREATE TABLE production_stages(id integer PRIMARY KEY,code text)'))
            conn.execute(text('CREATE TABLE technical_card_stage_results(id integer PRIMARY KEY,technical_card_id integer,production_stage_id integer,tech_operation_id integer,is_required boolean,status text,completed_at timestamptz)'))
            conn.execute(text('CREATE TABLE stock_documents(technical_card_id integer,doc_type text,status text)'))
            conn.execute(text("INSERT INTO technical_cards VALUES(1,'completed','[]','{}',NULL,NULL),(2,'in_progress','[]','{}',NULL,NULL)"))
            conn.execute(text("INSERT INTO technical_card_stage_results VALUES(1,1,NULL,1,true,'completed','2026-10-15T10:00:00Z')"))
            with Operations.context(MigrationContext.configure(conn)):
                module.upgrade()
                assert conn.execute(text('SELECT fulfillment_status FROM technical_cards ORDER BY id')).scalars().all() == ['ready_to_ship', None]
                module.downgrade()
                assert conn.execute(text('SELECT id,status FROM technical_cards ORDER BY id')).all() == [(1,'completed'),(2,'in_progress')]
                module.upgrade()
                assert conn.scalar(text("SELECT COUNT(*) FROM technical_cards WHERE fulfillment_status='ready_to_ship'")) == 1
    finally:
        assert schema.startswith('fulfillment_test_') and len(schema.removeprefix('fulfillment_test_')) == 32
        with engine.begin() as conn:
            conn.execute(text('DROP SCHEMA IF EXISTS ' + schema + ' CASCADE'))
        engine.dispose()
