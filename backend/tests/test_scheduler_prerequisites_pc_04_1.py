"""PC-04.1 data prerequisites. No demand calculation and no automatic placement."""
from datetime import date, datetime, timezone
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError
from sqlalchemy import create_engine, event, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.deps_auth import get_current_platform_user
from app.database.base import Base
from app.database.session import get_db
from app.main import app
from app.models.auth import PlatformUser
from app.models.calendar_allocation import CalendarAllocation
from app.models.calendar_assignment import CalendarAssignment
from app.models.production_capacity import CapacityResource
from app.models.production_stage import ProductionStage
from app.models.rbac import Permission, Role
from app.models.shop_routing import ShopRoutingStageLine, ShopRoutingTemplate
from app.models.technical_card import TechnicalCard, TechnicalCardOrderGroup
from app.schemas.calendar_allocation import CalendarAllocationCreate
from app.schemas.technical_card import TechnicalCardPlanningUpdate, TechnicalCardStandaloneCreate
from app.services.calendar_allocations import AllocationError, add_allocation, list_allocations
from app.services.rbac import PERM_TECHNICAL_CARDS_CREATE
from app.services.scheduler_horizon import SCHEDULER_HORIZON_DAYS
from app.services.standalone_technical_cards import create_standalone_technical_card
from app.services.technical_card_planning import planning_start_on, update_technical_card_planning
from app.services.technical_cards import to_technical_card_read


@pytest.fixture
def planner():
    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    @event.listens_for(engine, "connect")
    def foreign_keys(connection, _):
        connection.execute("PRAGMA foreign_keys=ON")

    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, expire_on_commit=False)
    with factory() as db:
        group = TechnicalCardOrderGroup(
            order_number="PLAN-1", tech_cards_planned_count=2, desired_date=date(2026, 12, 1)
        )
        db.add(group)
        db.flush()
        template = ShopRoutingTemplate(name="Print route", code="print-route")
        db.add(template)
        db.flush()
        db.add_all([
            TechnicalCard(
                id=1, order_group_id=group.id, number="TC-1", card_seq=1,
                quantity=Decimal("12"), nomenclature_name="Форма", routing_template_id=template.id,
            ),
            ProductionStage(id=1, name="Подготовка к запуску", code="launch_preparation", sort_order=0, is_active=True),
            ProductionStage(id=2, name="Печать", code="print", sort_order=1, is_active=True),
            ShopRoutingStageLine(
                id=10, routing_template_id=template.id, stage_order=1,
                production_stage_id=2, stage_label="Печать 1",
            ),
            ShopRoutingStageLine(
                id=11, routing_template_id=template.id, stage_order=2,
                production_stage_id=2, stage_label="Печать 2",
            ),
            CapacityResource(
                resource_key="sewers", name="Швеи", resource_type="labor", capacity_unit="labor_hour",
                calculation_mode="explicit_hours", staff_count=2, hours_per_day=Decimal("8"),
                shifts_per_day=1, efficiency=Decimal("1"), working_days=[0, 1, 2, 3, 4],
            ),
            CapacityResource(
                resource_key="plotter_1", name="Плоттер", resource_type="throughput", capacity_unit="linear_meter",
                calculation_mode="rate", base_rate=Decimal("15"), staff_count=1, hours_per_day=Decimal("8"),
                shifts_per_day=1, efficiency=Decimal("1"), working_days=[0, 1, 2, 3, 4],
            ),
            CapacityResource(
                resource_key="procurement", name="Закупка", resource_type="milestone", capacity_unit=None,
                calculation_mode="milestone", shifts_per_day=1, efficiency=Decimal("1"),
                working_days=[0, 1, 2, 3, 4],
            ),
        ])
        db.commit()
        template_id = template.id
    user = PlatformUser(id=1, login="planner", display_name="Planner", roles=[
        Role(code="planner", name="Planner", permissions=[Permission(code=PERM_TECHNICAL_CARDS_CREATE)])
    ])

    def db_override():
        with factory() as db:
            yield db

    original = dict(app.dependency_overrides)
    app.dependency_overrides[get_db] = db_override
    app.dependency_overrides[get_current_platform_user] = lambda: user
    try:
        with TestClient(app) as client:
            yield client, factory, template_id
    finally:
        app.dependency_overrides.clear()
        app.dependency_overrides.update(original)
        engine.dispose()


def test_horizon_is_a_constant_not_a_card_field():
    assert SCHEDULER_HORIZON_DAYS == 120
    assert "planning_horizon" not in TechnicalCard.__table__.columns
    assert "horizon_days" not in TechnicalCard.__table__.columns


def test_moscow_creation_date_is_the_local_calendar_day():
    moment = datetime(2026, 10, 6, 22, 30, tzinfo=timezone.utc)
    assert planning_start_on(moment, "Europe/Moscow") == date(2026, 10, 7)
    assert planning_start_on(moment, "UTC") == date(2026, 10, 6)


def test_standalone_create_defaults_do_not_copy_desired_date(planner):
    _, factory, _ = planner
    before = planning_start_on(datetime.now(timezone.utc), "Europe/Moscow")
    with factory() as db:
        card = create_standalone_technical_card(
            db,
            TechnicalCardStandaloneCreate(
                nomenclature_name="Кепка",
                order_number="PLAN-9",
                tech_cards_planned_count=1,
                desired_date=date(2026, 12, 1),
            ),
        )
        db.commit()
        after = planning_start_on(datetime.now(timezone.utc), "Europe/Moscow")
        assert card.planning_start_date in {before, after}
        assert card.shipping_date is None
        assert card.priority is None
        assert card.plan_locked is False
        read = to_technical_card_read(db, card)
        assert read.desired_date == date(2026, 12, 1)
        assert read.shipping_date is None
        assert read.planning_start_date == card.planning_start_date


def test_explicit_planning_fields_round_trip_and_priority_rejects_zero(planner):
    client, factory, _ = planner
    with factory() as db:
        card = create_standalone_technical_card(
            db,
            TechnicalCardStandaloneCreate(
                nomenclature_name="Шорты",
                order_number="PLAN-8",
                tech_cards_planned_count=1,
                desired_date=date(2026, 11, 2),
                planning_start_date=date(2026, 10, 3),
                shipping_date=date(2026, 11, 20),
                priority=2,
                plan_locked=True,
            ),
        )
        db.commit()
        card_id = card.id
    with pytest.raises(ValidationError):
        TechnicalCardPlanningUpdate(priority=0)
    patched = client.patch(
        f"/technical-cards/{card_id}/planning",
        json={"shipping_date": "2026-11-25", "priority": 1, "plan_locked": False},
    )
    assert patched.status_code == 200, patched.text
    body = patched.json()
    assert body["planning_start_date"] == "2026-10-03"
    assert body["shipping_date"] == "2026-11-25"
    assert body["desired_date"] == "2026-11-02"
    assert body["priority"] == 1
    assert body["plan_locked"] is False
    cleared = client.patch(f"/technical-cards/{card_id}/planning", json={"priority": None, "shipping_date": None})
    assert cleared.status_code == 200, cleared.text
    assert cleared.json()["priority"] is None
    assert cleared.json()["shipping_date"] is None
    assert cleared.json()["desired_date"] == "2026-11-02"
    assert client.patch(f"/technical-cards/{card_id}/planning", json={}).status_code == 422
    assert client.patch(f"/technical-cards/{card_id}/planning", json={"desired_date": "2026-11-01"}).status_code == 422
    with factory() as db:
        stored = db.get(TechnicalCard, card_id)
        stored.priority = 0
        with pytest.raises(IntegrityError):
            db.flush()


def test_older_card_planning_start_is_editable_and_starts_null(planner):
    _, factory, _ = planner
    with factory() as db:
        card = db.get(TechnicalCard, 1)
        assert card.planning_start_date is None
        update_technical_card_planning(
            db, 1, TechnicalCardPlanningUpdate(planning_start_date=date(2026, 9, 1))
        )
        db.commit()
        assert db.get(TechnicalCard, 1).planning_start_date == date(2026, 9, 1)
        assert db.get(TechnicalCardOrderGroup, card.order_group_id).desired_date == date(2026, 12, 1)


def test_enqueue_stays_manual_and_two_route_steps_share_a_stage(planner):
    client, factory, template_id = planner
    created = client.post(
        "/production-calendar/assignments",
        json={"technical_card_id": 1, "planned_date": "2026-10-05"},
    )
    assert created.status_code == 200, created.text
    row = created.json()
    assert row["routing_stage_line_id"] is None
    assert row["planning_mode"] == "manual_adjusted"
    assert row["manual_lock"] is True
    with factory() as db:
        card = db.get(TechnicalCard, 1)
        assert card.routing_template_id == template_id
        db.add_all([
            CalendarAssignment(
                technical_card_id=1, production_stage_id=2, routing_stage_line_id=10,
                planned_date=date(2026, 10, 8), planned_end_date=date(2026, 10, 8),
                planning_mode="auto", manual_lock=False,
            ),
            CalendarAssignment(
                technical_card_id=1, production_stage_id=2, routing_stage_line_id=11,
                planned_date=date(2026, 10, 9), planned_end_date=date(2026, 10, 9),
                planning_mode="locked", manual_lock=True,
            ),
        ])
        db.commit()
        ids = db.scalars(
            select(CalendarAssignment.id).where(CalendarAssignment.routing_stage_line_id.is_not(None))
        ).all()
        assert len(ids) == 2
        step_id = db.scalar(
            select(CalendarAssignment.id).where(CalendarAssignment.routing_stage_line_id == 10)
        )
        duplicate = CalendarAssignment(
            technical_card_id=1, production_stage_id=2, routing_stage_line_id=10,
            planned_date=date(2026, 10, 10), planned_end_date=date(2026, 10, 10),
            planning_mode="auto", manual_lock=False,
        )
        db.add(duplicate)
        with pytest.raises(IntegrityError):
            db.flush()
        db.rollback()
    moved = client.put(
        f"/production-calendar/assignments/{step_id}",
        json={"production_stage_id": 2, "planned_date": "2026-10-12", "position": 1},
    )
    assert moved.status_code == 200, moved.text
    assert moved.json()["routing_stage_line_id"] == 10
    assert moved.json()["planning_mode"] == "auto"
    conflict = client.put(
        f"/production-calendar/assignments/{row['id']}",
        json={"production_stage_id": 2, "planned_date": "2026-10-12"},
    )
    assert conflict.status_code == 200, conflict.text
    assert conflict.json()["routing_stage_line_id"] is None
    assert conflict.json()["planning_mode"] == "manual_adjusted"
    assert conflict.json()["manual_lock"] is True


def test_allocations_keep_units_days_and_resources_and_follow_the_assignment(planner):
    client, factory, _ = planner
    created = client.post(
        "/production-calendar/assignments",
        json={"technical_card_id": 1, "planned_date": "2026-10-05"},
    )
    assignment_id = created.json()["id"]
    with factory() as db:
        first = add_allocation(db, CalendarAllocationCreate(
            assignment_id=assignment_id, resource_key="sewers", date=date(2026, 10, 7),
            allocated_amount=Decimal("1.5000"), capacity_unit="labor_hour",
        ))
        second = add_allocation(db, CalendarAllocationCreate(
            assignment_id=assignment_id, resource_key="sewers", date=date(2026, 10, 8),
            allocated_amount=Decimal("2"), capacity_unit="labor_hour",
        ))
        third = add_allocation(db, CalendarAllocationCreate(
            assignment_id=assignment_id, resource_key="plotter_1", date=date(2026, 10, 7),
            allocated_amount=Decimal("15"), capacity_unit="linear_meter",
        ))
        assert [item.capacity_unit for item in (first, second, third)] == [
            "labor_hour", "labor_hour", "linear_meter",
        ]
        assert [item.date for item in list_allocations(db, assignment_id)] == [
            date(2026, 10, 7), date(2026, 10, 7), date(2026, 10, 8),
        ]
        with pytest.raises(AllocationError):
            add_allocation(db, CalendarAllocationCreate(
                assignment_id=assignment_id, resource_key="sewers", date=date(2026, 10, 7),
                allocated_amount=Decimal("1"), capacity_unit="labor_hour",
            ))
        with pytest.raises(AllocationError):
            add_allocation(db, CalendarAllocationCreate(
                assignment_id=assignment_id, resource_key="plotter_1", date=date(2026, 10, 9),
                allocated_amount=Decimal("1"), capacity_unit="labor_hour",
            ))
        with pytest.raises(AllocationError):
            add_allocation(db, CalendarAllocationCreate(
                assignment_id=assignment_id, resource_key="procurement", date=date(2026, 10, 9),
                allocated_amount=Decimal("1"), capacity_unit="item",
            ))
        assert db.scalar(select(CalendarAllocation.id).where(CalendarAllocation.assignment_id == assignment_id))
    assert client.delete(f"/production-calendar/assignments/{assignment_id}").status_code == 204
    with factory() as db:
        assert list_allocations(db, assignment_id) == []
