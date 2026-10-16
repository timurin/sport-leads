"""Concurrency on canonical local PostgreSQL, using an isolated owned test schema."""
from concurrent.futures import ThreadPoolExecutor
from datetime import date, timedelta
from uuid import uuid4

import pytest
from sqlalchemy import create_engine, event, select, func, text
from sqlalchemy.engine import make_url
from sqlalchemy.orm import sessionmaker

from app.config.settings import settings
from app.database.base import Base
from app.models.calendar_allocation import CalendarAllocation
from app.models.production_capacity import CapacityResource, TechOperationCapacityResource
from app.models.production_stage import ProductionStage
from app.models.shop_routing import ShopRoutingTemplate, ShopRoutingStageLine
from app.models.tech_operation import TechOperation
from app.models.technical_card import TechnicalCard, TechnicalCardOrderGroup
from app.services.production_scheduler import schedule_card
from app.services.route_snapshot import copy_template_snapshot


def test_concurrent_shared_resource_commands_do_not_overbook():
    url = make_url(settings.database_url)
    if url.host not in {"localhost", "127.0.0.1"} or (url.port or 5432) != 5432:
        pytest.skip("Only canonical local PostgreSQL :5432 is allowed")
    schema = "scheduler_test_" + uuid4().hex
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
        today = date(2026, 10, 7)
        with factory() as db:
            db.add_all([
                ProductionStage(id=1, name="Test production", code="production", is_active=True),
                ShopRoutingTemplate(id=1, name="Test route", code="route", is_active=True),
                TechOperation(id=1, name="Test items", code="items", volume_unit="pieces", production_stage_id=1),
                TechnicalCardOrderGroup(id=1, order_number="SCHEDULER-TEST", tech_cards_planned_count=2, desired_date=today + timedelta(days=20)),
            ])
            db.flush()
            db.add_all([
                ShopRoutingStageLine(id=1, routing_template_id=1, stage_order=1, stage_label="Production", production_stage_id=1, tech_operation_id=1),
                CapacityResource(resource_key="shared", name="Shared", resource_type="throughput", capacity_unit="item", calculation_mode="rate",
                                 production_stage_id=1, base_rate=100, staff_count=1, hours_per_day=1, working_days=list(range(7))),
            ])
            db.flush()
            db.add(TechOperationCapacityResource(tech_operation_id=1, resource_key="shared"))
            for card_id in [1, 2]:
                db.add(TechnicalCard(id=card_id, order_group_id=1, card_seq=card_id, number=f"SCHEDULER-TEST-{card_id}", quantity=100,
                                     routing_template_id=1, planning_start_date=today, shipping_date=today + timedelta(days=20)))
            db.flush()
            for card in db.scalars(select(TechnicalCard)):
                copy_template_snapshot(db, card)
            db.commit()
        def run(card_id):
            with factory() as db:
                return schedule_card(db, card_id, today=today)
        with ThreadPoolExecutor(max_workers=2) as executor:
            results = list(executor.map(run, [1, 2]))
        assert all(result.persisted and result.status == "planned" for result in results)
        assert sorted(result.steps[0].planned_start_date for result in results) == [today, today + timedelta(days=1)]
        with factory() as db:
            amounts = db.execute(select(CalendarAllocation.date, func.sum(CalendarAllocation.allocated_amount)).group_by(CalendarAllocation.date)).all()
            assert len(amounts) == 2 and all(amount <= 100 for _, amount in amounts)
    finally:
        if engine is not None:
            engine.dispose()
        # Only this UUID-owned schema can be dropped; public/owner data is never targeted.
        assert schema.startswith("scheduler_test_") and len(schema.removeprefix("scheduler_test_")) == 32
        with admin.begin() as connection:
            connection.execute(text("DROP SCHEMA IF EXISTS " + schema + " CASCADE"))
        admin.dispose()
