"""Read existing VIS-STRESS cards; schedule a print-only clone in an owned schema.

Run from backend: python scripts/validate_work_center_stress.py
Never writes to public tables or changes/deletes the source stress dataset.
"""
import json
import sys
from pathlib import Path
from datetime import date, timedelta
from uuid import uuid4

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import create_engine, event, func, select, text
from sqlalchemy.engine import make_url
from sqlalchemy.orm import sessionmaker

from app.config.settings import settings
from app.database.base import Base
from app.models.calendar_allocation import CalendarAllocation
from app.models.production_capacity import CapacityResource, ProductionCapacityException, TechOperationCapacityResource
from app.models.production_stage import ProductionStage
from app.models.shop_routing import WorkCenter, ShopRoutingTemplate, ShopRoutingStageLine
from app.models.tech_operation import TechOperation
from app.models.technical_card import TechnicalCard, TechnicalCardOrderGroup, TechnicalCardOperationLine
from app.services.production_queue_scheduler import schedule_queue


def validate():
    url = make_url(settings.database_url)
    assert url.host in {"localhost", "127.0.0.1"} and (url.port or 5432) == 5432, "Local PostgreSQL :5432 only"
    admin = create_engine(settings.database_url, echo=False)
    with admin.connect() as source:
        original = [dict(row) for row in source.execute(select(TechnicalCard.__table__).where(
            TechnicalCard.number.like("VIS-STRESS-%")).order_by(TechnicalCard.id)).mappings()]
    assert {row["number"] for row in original} == {f"VIS-STRESS-{index:03d}" for index in range(1, 31)}
    schema = "wc_stress_test_" + uuid4().hex
    engine = None
    try:
        with admin.begin() as connection:
            connection.execute(text("CREATE SCHEMA " + schema))
        engine = create_engine(settings.database_url, echo=False)
        @event.listens_for(engine, "connect")
        def search_path(connection, _):
            with connection.cursor() as cursor:
                cursor.execute("SET search_path TO " + schema)
            connection.commit()
        Base.metadata.create_all(engine)
        factory = sessionmaker(bind=engine, expire_on_commit=False)
        today = date(2026, 10, 7)
        rates = [15, 20, 10, 30]
        with factory() as db:
            db.add_all([ProductionStage(id=1, name="Fixture print", code="print"),
                        ShopRoutingTemplate(id=1, name="Fixture print", code="wc-stress"),
                        TechnicalCardOrderGroup(id=1, order_number="WC-STRESS", tech_cards_planned_count=30, desired_date=today + timedelta(days=15))])
            db.flush()
            db.add(TechOperation(id=1, name="Fixture print", code="wc-print", production_stage_id=1, volume_unit="linear_meters"))
            db.flush()
            db.add(ShopRoutingStageLine(id=1, routing_template_id=1, stage_order=1, stage_label="Print", production_stage_id=1, tech_operation_id=1))
            for index, rate in enumerate(rates, 1):
                db.add(WorkCenter(id=index, name=f"Plotter {index}", code=f"WC-P{index}", production_stage_id=1))
                db.flush()
                db.add(CapacityResource(resource_key=f"wc-plotter-{index}", name=f"Plotter {index}", resource_type="machine", work_center_id=index,
                    production_stage_id=1, capacity_unit="linear_meter", base_rate=rate, calculation_mode="rate", hours_per_day=10,
                    shifts_per_day=1, efficiency=1, working_days=list(range(7)), staff_count=None))
                db.flush()
                db.add(TechOperationCapacityResource(tech_operation_id=1, resource_key=f"wc-plotter-{index}"))
            db.add(ProductionCapacityException(resource_key="wc-plotter-4", date=today, unavailable=True))
            for sequence, source in enumerate(original, 1):
                card = TechnicalCard(id=source["id"], number=source["number"], quantity=source["quantity"], priority=source["priority"],
                    card_seq=sequence, order_group_id=1, status=source["status"], plan_locked=source["plan_locked"],
                    routing_template_id=1, planning_start_date=source["planning_start_date"], shipping_date=source["shipping_date"])
                db.add(card)
                db.flush()
                db.add(TechnicalCardOperationLine(technical_card_id=card.id, sequence=1, source_kind="routing", tech_operation_id=1,
                    operation_name="Fixture print", production_stage_id=1, stage_order=1, volume_unit="linear_meters", volume=card.quantity))
            db.commit()
            result = schedule_queue(db, today=today)
            totals = list(db.execute(select(CalendarAllocation.resource_key, CalendarAllocation.date, func.sum(CalendarAllocation.allocated_amount))
                .group_by(CalendarAllocation.resource_key, CalendarAllocation.date)))
            seen = set()
            for key, day, amount in totals:
                index = int(key.rsplit("-", 1)[1])
                assert amount <= (0 if index == 4 and day == today else rates[index - 1] * 10)
                seen.add(index)
            assert len(seen) >= 2
            repeat = schedule_queue(db, today=today)
            assert repeat.model_dump() == result.model_dump()
            print(json.dumps({"source_cards": len(original), "planned_cards": result.planned_cards, "blocked_cards": result.blocked_cards,
                "used_work_centers": sorted(seen), "daily_allocations": [[key, str(day), str(amount)] for key, day, amount in totals]}, sort_keys=True))
    finally:
        if engine is not None:
            engine.dispose()
        assert schema.startswith("wc_stress_test_") and len(schema.removeprefix("wc_stress_test_")) == 32
        with admin.begin() as connection:
            connection.execute(text("DROP SCHEMA IF EXISTS " + schema + " CASCADE"))
        with admin.connect() as source:
            after = [dict(row) for row in source.execute(select(TechnicalCard.__table__).where(
                TechnicalCard.number.like("VIS-STRESS-%")).order_by(TechnicalCard.id)).mappings()]
            assert original == after, "Source VIS-STRESS cards changed"
        admin.dispose()
    print("PASS: 30 source VIS-STRESS cards unchanged; owned print fixture removed")


if __name__ == "__main__":
    validate()
