"""Isolated migration cycle and concurrent schedule/selection on local :5432."""
import importlib.util
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from threading import Barrier
from uuid import uuid4

import pytest
from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import create_engine, event, select, text
from sqlalchemy.engine import make_url
from sqlalchemy.orm import sessionmaker

from app.config.settings import settings
from app.database.base import Base
from app.models.calendar_assignment import CalendarAssignment
from app.models.calendar_allocation import CalendarAllocation
from app.models.production_capacity import CapacityResource, TechOperationCapacityResource
from app.models.production_stage import ProductionStage
from app.models.shop_routing import ShopRoutingTemplate
from app.models.tech_operation import TechOperation
from app.models.technical_card import TechnicalCard, TechnicalCardOrderGroup
from app.services.route_snapshot import copy_template_snapshot
from app.services.production_scheduler import schedule_card
from tests.test_route_variants_pc_04_4i import seed_variant, patch, TODAY


def local_engine():
    url = make_url(settings.database_url)
    if url.host not in {"localhost", "127.0.0.1"} or (url.port or 5432) != 5432:
        pytest.skip("Only canonical local PostgreSQL :5432")
    return create_engine(settings.database_url)


def test_variant_migration_isolated_upgrade_downgrade_upgrade():
    engine = local_engine()
    schema = "pc044i_migration_" + uuid4().hex
    path = Path(__file__).resolve().parents[1] / "alembic/versions/b8c9d0e1f234_route_variants.py"
    spec = importlib.util.spec_from_file_location("variants_revision", path)
    revision = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(revision)
    with engine.connect() as connection:
        transaction = connection.begin()
        try:
            connection.execute(text("CREATE SCHEMA " + schema))
            connection.execute(text("SET LOCAL search_path TO " + schema))
            connection.execute(text("CREATE TABLE shop_routing_templates (id integer PRIMARY KEY)"))
            connection.execute(text("CREATE TABLE technical_cards (id integer PRIMARY KEY)"))
            connection.execute(text("INSERT INTO shop_routing_templates VALUES (1)"))
            connection.execute(text("INSERT INTO technical_cards VALUES (1)"))
            revision.op = Operations(MigrationContext.configure(connection))
            revision.upgrade()
            assert connection.execute(text("SELECT route_variant_groups, route_variant_selections FROM technical_cards")).one() == ([], {})
            connection.execute(text("UPDATE technical_cards SET route_variant_groups = '[{\"id\":\"test\"}]', route_variant_selections = '{\"test\":{\"selection_status\":\"preliminary\"}}'"))
            assert connection.execute(text("SELECT route_variant_groups FROM technical_cards")).scalar() == [{"id": "test"}]
            revision.downgrade()
            assert connection.execute(text("SELECT count(*) FROM technical_cards")).scalar() == 1
            revision.upgrade()
            assert connection.execute(text("SELECT route_variant_groups, route_variant_selections FROM technical_cards")).one() == ([], {})
        finally:
            transaction.rollback()
            engine.dispose()


@pytest.fixture
def postgres_variant_factory():
    admin = local_engine()
    schema = "pc044i_concurrency_" + uuid4().hex
    engine = None
    try:
        with admin.begin() as connection:
            connection.execute(text("CREATE SCHEMA " + schema))
        engine = local_engine()
        @event.listens_for(engine, "connect")
        def search_path(connection, _):
            with connection.cursor() as cursor:
                cursor.execute("SET search_path TO " + schema)
            connection.commit()
        Base.metadata.create_all(engine)
        factory = sessionmaker(bind=engine, expire_on_commit=False)
        with factory() as db:
            db.add_all([
                ProductionStage(id=1, name="Production", code="production", is_active=True),
                ShopRoutingTemplate(id=1, name="Route", is_active=True),
                TechOperation(id=1, name="Lay", code="lay", volume_unit="pieces", production_stage_id=1),
                TechOperation(id=2, name="Laser", code="laser", volume_unit="pieces", production_stage_id=1),
                TechnicalCardOrderGroup(id=1, order_number="ONEOF-TEST", tech_cards_planned_count=1, desired_date=TODAY),
                CapacityResource(resource_key="items", name="Lay", resource_type="throughput", capacity_unit="item",
                                 calculation_mode="rate", production_stage_id=1, base_rate=100, staff_count=1,
                                 hours_per_day=1, working_days=list(range(7))),
            ])
            db.flush()
            db.add(TechOperationCapacityResource(tech_operation_id=1, resource_key="items"))
            db.commit()
        nodes = seed_variant(factory)
        yield factory, nodes
    finally:
        if engine is not None:
            engine.dispose()
        assert schema.startswith("pc044i_concurrency_") and len(schema.removeprefix("pc044i_concurrency_")) == 32
        with admin.begin() as connection:
            connection.execute(text("DROP SCHEMA IF EXISTS " + schema + " CASCADE"))
        admin.dispose()


def test_selection_and_schedule_cannot_mix_old_and_new_plan(postgres_variant_factory):
    factory, nodes = postgres_variant_factory
    with factory() as db:
        assert schedule_card(db, 3, today=TODAY).persisted
    barrier = Barrier(2)
    def change():
        barrier.wait(timeout=10)
        return patch(factory, nodes[4])
    def schedule():
        barrier.wait(timeout=10)
        with factory() as db:
            return schedule_card(db, 3, today=TODAY)
    with ThreadPoolExecutor(max_workers=2) as executor:
        change_future, schedule_future = executor.submit(change), executor.submit(schedule)
        assert change_future.result(timeout=30).plan.persisted
        assert schedule_future.result(timeout=30).persisted
    with factory() as db:
        assignments = list(db.scalars(select(CalendarAssignment).where(CalendarAssignment.technical_card_id == 3)))
        assert {row.stage_result_id for row in assignments} == {int(nodes[i].split(":")[1]) for i in [1, 4, 5]}
        allocations = list(db.execute(select(CalendarAllocation, CalendarAssignment).join(CalendarAssignment).where(CalendarAssignment.technical_card_id == 3)))
        assert len(allocations) == 3
        assert sum(allocation.resource_key == "laser" for allocation, _ in allocations) == 1


def test_selection_and_fact_start_are_serialized(postgres_variant_factory):
    from app.models.technical_card import TechnicalCardStageResult
    from app.services.technical_card_stages import start_stage
    from app.services.technical_cards import TechnicalCardConflictError, TechnicalCardNotFoundError
    factory, nodes = postgres_variant_factory
    with factory() as db:
        assert schedule_card(db, 3, today=TODAY).persisted
        db.get(TechnicalCardStageResult, int(nodes[1].split(":")[1])).status = "completed"
        db.commit()
    barrier = Barrier(2)
    def change():
        barrier.wait(timeout=10)
        try:
            return patch(factory, nodes[4])
        except TechnicalCardConflictError:
            return "fact_protected"
    def start():
        barrier.wait(timeout=10)
        with factory() as db:
            try:
                start_stage(db, 3, 3)
                return "started"
            except TechnicalCardNotFoundError:
                return "excluded"
    with ThreadPoolExecutor(max_workers=2) as executor:
        changed, started = executor.submit(change), executor.submit(start)
        results = changed.result(timeout=30), started.result(timeout=30)
    with factory() as db:
        card = db.get(TechnicalCard, 3)
        old = db.get(TechnicalCardStageResult, int(nodes[3].split(":")[1]))
        selected = card.route_variant_selections["cutting"]["selected_operation_snapshot_node_id"]
        if selected == nodes[3]:
            assert old.status == "in_progress" and results == ("fact_protected", "started")
        else:
            assert selected == nodes[4] and old.status == "pending" and results[1] == "excluded"


def test_selection_and_mass_schedule_cannot_mix_variants(postgres_variant_factory):
    from app.services.production_queue_scheduler import schedule_queue
    factory, nodes = postgres_variant_factory
    barrier = Barrier(2)
    def change():
        barrier.wait(timeout=10)
        return patch(factory, nodes[4])
    def schedule():
        barrier.wait(timeout=10)
        with factory() as db:
            return schedule_queue(db, today=TODAY)
    with ThreadPoolExecutor(max_workers=2) as executor:
        changed, scheduled = executor.submit(change), executor.submit(schedule)
        assert changed.result(timeout=30).plan.persisted
        assert scheduled.result(timeout=30).planned_cards == 1
    with factory() as db:
        assignments = list(db.scalars(select(CalendarAssignment).where(CalendarAssignment.technical_card_id == 3)))
        assert {row.stage_result_id for row in assignments} == {int(nodes[i].split(":")[1]) for i in [1, 4, 5]}
