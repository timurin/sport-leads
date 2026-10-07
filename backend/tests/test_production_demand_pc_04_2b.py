"""PC-04.2B read-only demand. No assignments, allocations, or date search."""
from datetime import date
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event, select, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database.base import Base
from app.database.session import get_db
from app.main import app
from app.models.calendar_allocation import CalendarAllocation
from app.models.calendar_assignment import CalendarAssignment
from app.models.product_model import (
    AssemblyOperationLine,
    AssemblyVariant,
    ProductModel,
    ProductModelSizeType,
    ProductModelStatus,
)
from app.models.production_capacity import CapacityResource, TechOperationCapacityResource
from app.models.production_stage import ProductionStage
from app.models.sewing_operation import SewingOperation
from app.models.shop_routing import ShopRoutingStageLine, ShopRoutingTemplate
from app.models.tech_operation import TechOperation
from app.models.technical_card import (
    TechOperationVolumeUnit,
    TechnicalCard,
    TechnicalCardOperationLine,
    TechnicalCardOperationLineSourceKind,
    TechnicalCardOrderGroup,
)
from app.services.production_demand import calculate_demands
from app.services.production_demand_snapshot import (
    AppliedSewingRow,
    CardDemandSnapshot,
    DemandStep,
    ResourceView,
    SewingSource,
    VolumeRow,
    build_sewing_sources,
)


def resource(**kwargs):
    payload = dict(
        name=kwargs["resource_key"],
        staff_count=1,
        hours_per_day=Decimal("8"),
        shifts_per_day=1,
        efficiency=Decimal("1"),
        working_days=[0, 1, 2, 3, 4],
        include_in_calendar_load=True,
    )
    payload.update(kwargs)
    return CapacityResource(**payload)


@pytest.fixture
def demand_client():
    engine = create_engine("sqlite+pysqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)

    @event.listens_for(engine, "connect")
    def foreign_keys(connection, _):
        connection.execute("PRAGMA foreign_keys=ON")

    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, expire_on_commit=False)
    with factory() as db:
        db.add_all([
            ProductionStage(id=1, name="Печать", code="print", sort_order=1, is_active=True),
            ProductionStage(id=2, name="Пошив", code="sewing", sort_order=2, is_active=True),
            ProductionStage(id=3, name="Упаковка", code="packing", sort_order=3, is_active=True),
            ShopRoutingTemplate(id=1, name="Маршрут", code="route-1"),
            ProductModel(
                id=1, article="PM-1", name="Форма", size_type=ProductModelSizeType.MEN,
                status=ProductModelStatus.ACTIVE,
            ),
            SewingOperation(id=5, name="Стачать"),
            TechOperation(id=1, name="Печать", code="print-op", volume_unit=TechOperationVolumeUnit.LINEAR_METERS, production_stage_id=1),
            TechOperation(id=2, name="Пошив", code="sewing-named-like-sewing", volume_unit=TechOperationVolumeUnit.PIECES, production_stage_id=2),
            TechOperation(id=3, name="Термоперенос", code="heat", volume_unit=TechOperationVolumeUnit.LINEAR_METERS, production_stage_id=1),
            TechOperation(id=4, name="Упаковка", code="pack", volume_unit=TechOperationVolumeUnit.PIECES, production_stage_id=3),
            TechOperation(id=5, name="Закупка", code="buy", volume_unit=TechOperationVolumeUnit.PIECES, production_stage_id=3),
            TechOperation(id=6, name="Раскрой", code="cut", volume_unit=TechOperationVolumeUnit.PIECES, production_stage_id=1),
            TechOperation(id=7, name="Изделия", code="items", volume_unit=TechOperationVolumeUnit.PIECES, production_stage_id=3),
            resource(resource_key="sewers", resource_type="labor", capacity_unit="labor_hour", calculation_mode="sewing_norm"),
            resource(resource_key="print_operator", resource_type="labor", capacity_unit="labor_hour", calculation_mode="explicit_hours"),
            resource(resource_key="plotter_1", resource_type="machine", capacity_unit="linear_meter", calculation_mode="rate", base_rate=Decimal("15"), staff_count=None),
            resource(resource_key="calender", resource_type="machine", capacity_unit="linear_meter", calculation_mode="rate", base_rate=Decimal("60"), staff_count=None),
            resource(resource_key="hourly_meter", resource_type="machine", capacity_unit="machine_hour", calculation_mode="rate", base_rate=Decimal("15"), staff_count=None),
            resource(resource_key="meter_press", resource_type="throughput", capacity_unit="linear_meter", calculation_mode="rate", base_rate=Decimal("15")),
            resource(resource_key="item_gate", resource_type="throughput", capacity_unit="item", calculation_mode="rate", base_rate=Decimal("20")),
            resource(resource_key="packing_team", resource_type="labor", capacity_unit="item", calculation_mode="team_rate", base_rate=Decimal("80"), staff_count=1),
            resource(resource_key="procurement", resource_type="milestone", capacity_unit=None, calculation_mode="milestone", base_rate=None, staff_count=None, hours_per_day=None),
            resource(resource_key="cutters", resource_type="labor", capacity_unit="item", calculation_mode="cutting_methods"),
            resource(resource_key="laser", resource_type="machine", capacity_unit="item", calculation_mode="rate", base_rate=Decimal("100"), staff_count=None),
            resource(resource_key="hidden_sewers", resource_type="labor", capacity_unit="labor_hour", calculation_mode="sewing_norm", include_in_calendar_load=False),
        ])
        db.flush()
        db.add_all([
            AssemblyVariant(id=1, product_model_id=1, name="Сборка"),
            ShopRoutingStageLine(id=10, routing_template_id=1, stage_order=1, production_stage_id=2, stage_label="Пошив", tech_operation_id=2),
            ShopRoutingStageLine(id=11, routing_template_id=1, stage_order=2, production_stage_id=1, stage_label="Печать", tech_operation_id=1),
            ShopRoutingStageLine(id=12, routing_template_id=1, stage_order=3, production_stage_id=1, stage_label="Термоперенос", tech_operation_id=3),
            ShopRoutingStageLine(id=13, routing_template_id=1, stage_order=4, production_stage_id=3, stage_label="Упаковка", tech_operation_id=4),
            ShopRoutingStageLine(id=14, routing_template_id=1, stage_order=5, production_stage_id=3, stage_label="Закупка", tech_operation_id=5),
            ShopRoutingStageLine(id=15, routing_template_id=1, stage_order=6, production_stage_id=1, stage_label="Раскрой", tech_operation_id=6),
            ShopRoutingStageLine(id=16, routing_template_id=1, stage_order=7, production_stage_id=3, stage_label="Изделия", tech_operation_id=7),
            AssemblyOperationLine(
                id=11, assembly_variant_id=1, sequence=1, operation_name="Стачать",
                duration_seconds=720, quantity_per_item=1, sewing_operation_id=5,
            ),
        ])
        db.add_all([
            TechOperationCapacityResource(tech_operation_id=2, resource_key="sewers"),
            TechOperationCapacityResource(tech_operation_id=2, resource_key="hidden_sewers"),
            TechOperationCapacityResource(tech_operation_id=1, resource_key="meter_press"),
            TechOperationCapacityResource(tech_operation_id=1, resource_key="print_operator"),
            TechOperationCapacityResource(tech_operation_id=1, resource_key="plotter_1"),
            TechOperationCapacityResource(tech_operation_id=1, resource_key="calender"),
            TechOperationCapacityResource(tech_operation_id=1, resource_key="hourly_meter"),
            TechOperationCapacityResource(tech_operation_id=3, resource_key="print_operator"),
            TechOperationCapacityResource(tech_operation_id=4, resource_key="packing_team"),
            TechOperationCapacityResource(tech_operation_id=5, resource_key="procurement"),
            TechOperationCapacityResource(tech_operation_id=6, resource_key="cutters"),
            TechOperationCapacityResource(tech_operation_id=7, resource_key="item_gate"),
            TechOperationCapacityResource(tech_operation_id=7, resource_key="laser"),
        ])
        group = TechnicalCardOrderGroup(order_number="DEMAND-1", tech_cards_planned_count=1, desired_date=date(2026, 12, 1))
        db.add(group)
        db.flush()
        db.add(TechnicalCard(
            id=1, order_group_id=group.id, number="TC-DEMAND", card_seq=1, quantity=Decimal("1000"),
            nomenclature_name="Форма", routing_template_id=1, product_model_id=1, assembly_variant_id=1,
        ))
        db.flush()
        db.add_all([
            TechnicalCardOperationLine(
                technical_card_id=1, sequence=1, source_kind=TechnicalCardOperationLineSourceKind.SEWING,
                sewing_operation_id=5, operation_name="Стачать", volume_unit=TechOperationVolumeUnit.PIECES,
                volume=Decimal("0"), stage_order=1, production_stage_id=2, stage_label="Пошив",
            ),
            TechnicalCardOperationLine(
                technical_card_id=1, sequence=2, source_kind=TechnicalCardOperationLineSourceKind.ROUTING,
                tech_operation_id=1, operation_name="Печать", volume_unit=TechOperationVolumeUnit.LINEAR_METERS,
                volume=Decimal("300"), stage_order=2, production_stage_id=1, stage_label="Печать",
            ),
        ])
        db.commit()
        group_id = group.id
    writes: list[str] = []

    def track(_, __, statement, ___, ____, _____):
        if statement.lstrip()[:6].upper() in {"INSERT", "UPDATE", "DELETE"}:
            writes.append(statement)

    def db_override():
        with factory() as db:
            event.listen(engine, "before_cursor_execute", track)
            try:
                yield db
            finally:
                event.remove(engine, "before_cursor_execute", track)

    original = dict(app.dependency_overrides)
    app.dependency_overrides[get_db] = db_override
    try:
        with TestClient(app) as client:
            yield client, factory, writes, group_id
    finally:
        app.dependency_overrides.clear()
        app.dependency_overrides.update(original)
        engine.dispose()


def step(body, line_id):
    return next(row for row in body["steps"] if row["routing_stage_line_id"] == line_id)


def demand(body, line_id, key):
    return next(row for row in step(body, line_id)["demands"] if row["resource_key"] == key)


def test_sewing_ready_and_missing_norm_and_snapshot_preference(demand_client):
    client, factory, _, _ = demand_client
    body = client.get("/technical-cards/1/demand").json()
    sewing = demand(body, 10, "sewers")
    assert sewing["status"] == "ready"
    assert sewing["amount"] == "200"
    assert sewing["unit"] == "labor_hour"
    assert sewing["source_type"] == "sewing_operation_times"
    assert sewing["details"]["norm_table"] == "assembly_operation_lines"
    assert sewing["details"]["seconds_per_item"] == "720"
    hidden = demand(body, 10, "hidden_sewers")
    assert hidden["status"] == "not_applicable"
    assert hidden["details"]["reason_code"] == "resource_excluded"
    assert "seconds_per_item" not in hidden["details"]
    assert step(body, 10)["status"] == "ready"
    with factory() as db:
        db.get(AssemblyOperationLine, 11).duration_seconds = 0
        db.commit()
    missing = client.get("/technical-cards/1/demand?routing_stage_line_id=10").json()
    failed = demand(missing, 10, "sewers")
    assert failed["status"] == "missing_input"
    assert failed["details"]["reason_code"] == "missing_sewing_norm"
    assert failed["amount"] is None
    sources, unverified = build_sewing_sources(
        sales_order_item_id=9,
        product_model_id=1,
        variant_model_id=1,
        snapshots=[type("Snap", (), {"id": 3, "sewing_operation_id": 5, "operation_name": "Стачать", "duration_seconds": 360, "quantity_per_item": 2})()],
        variant_lines=[type("Line", (), {"id": 99, "sewing_operation_id": 5, "operation_name": "Стачать", "duration_seconds": 10, "quantity_per_item": 1})()],
    )
    assert unverified is False and sources[0].duration_seconds == 360 and sources[0].norm_table.endswith("snapshots")
    snapshot = CardDemandSnapshot(
        technical_card_id=1, quantity=Decimal("1000"), routing_template_id=1, sales_order_item_id=9,
        sewing_unverified=False, sewing_sources=sources, volumes=(),
        applied_sewing=(AppliedSewingRow(id=101, sewing_operation_id=5, operation_name="Стачать", stage_order=1, production_stage_id=2),),
        steps=(DemandStep(
            routing_stage_line_id=10, routing_template_id=1, stage_order=1, stage_label="Пошив",
            production_stage_id=2, operation_id=2, operation_name="Пошив", operation_stage_id=2,
            operation_volume_unit="pieces",
            resources=(ResourceView("sewers", "sewing_norm", "labor_hour", "labor", True),),
        ),),
    )
    calculated = calculate_demands(snapshot)
    assert calculated.steps[0].demands[0].amount == "200"
    assert calculated.steps[0].demands[0].details["norm_table"] == "sales_order_item_assembly_operation_snapshots"
    empty, flag = build_sewing_sources(
        sales_order_item_id=9, product_model_id=1, variant_model_id=1, snapshots=[], variant_lines=[],
    )
    assert empty == () and flag is False


def test_item_meters_team_milestone_manual_and_unit_mismatch(demand_client):
    client, factory, writes, _ = demand_client
    first = client.get("/technical-cards/1/demand")
    assert first.status_code == 200, first.text
    body = first.json()
    meters = demand(body, 11, "meter_press")
    assert meters["status"] == "ready" and meters["amount"] == "300" and meters["unit"] == "linear_meter"
    plotter = demand(body, 11, "plotter_1")
    assert plotter["status"] == "ready" and plotter["amount"] == "300" and plotter["unit"] == "linear_meter"
    calender = demand(body, 11, "calender")
    assert calender["status"] == "ready" and calender["amount"] == "300" and calender["unit"] == "linear_meter"
    mismatched = demand(body, 11, "hourly_meter")
    assert mismatched["status"] == "missing_input"
    assert mismatched["amount"] is None and mismatched["unit"] == "linear_meter"
    assert mismatched["details"]["reason_code"] == "capacity_unit_mismatch"
    assert mismatched["details"]["candidate_amount"] == "300"
    assert mismatched["details"]["expected_unit"] == "machine_hour"
    operator = demand(body, 11, "print_operator")
    assert operator["status"] == "manual_required"
    assert operator["details"]["reason_code"] == "missing_operator_norm"
    assert operator["amount"] is None and operator["unit"] == "labor_hour"
    assert step(body, 11)["status"] == "missing_input"
    assert {row["resource_key"] for row in step(body, 11)["demands"]} == {
        "calender", "hourly_meter", "meter_press", "plotter_1", "print_operator",
    }
    shared = demand(body, 12, "print_operator")
    assert shared["resource_key"] == operator["resource_key"]
    assert shared["routing_stage_line_id"] != operator["routing_stage_line_id"]
    assert shared["status"] == "manual_required"
    team = demand(body, 13, "packing_team")
    assert team["status"] == "ready" and team["amount"] == "1000" and team["unit"] == "item"
    milestone = demand(body, 14, "procurement")
    assert milestone["status"] == "not_applicable" and milestone["amount"] is None and milestone["unit"] is None
    assert step(body, 14)["status"] == "not_applicable"
    cutters = demand(body, 15, "cutters")
    assert cutters["status"] == "manual_required" and cutters["unit"] == "item"
    assert cutters["details"]["reason_code"] == "missing_cutting_mode"
    items = demand(body, 16, "item_gate")
    assert items["status"] == "ready" and items["amount"] == "1000" and items["unit"] == "item"
    laser = demand(body, 16, "laser")
    assert laser["status"] == "ready" and laser["amount"] == "1000" and laser["unit"] == "item"
    with factory() as db:
        assert db.scalar(select(CapacityResource.resource_key).where(CapacityResource.resource_key == "print_operator")) == "print_operator"
        assert db.scalar(text("SELECT count(*) FROM capacity_resources WHERE resource_key = 'print_operator'")) == 1
        db.get(CapacityResource, "packing_team").staff_count = 99
        db.commit()
    again = client.get("/technical-cards/1/demand").json()
    packed = demand(again, 13, "packing_team")
    assert packed["status"] == "ready" and packed["amount"] == "1000"
    assert again == client.get("/technical-cards/1/demand").json()
    assert writes == []


def test_missing_meters_missing_link_and_endpoint_does_not_change_rows(demand_client):
    client, factory, writes, group_id = demand_client
    with factory() as db:
        before_card = db.get(TechnicalCard, 1).updated_at
        before_assignments = db.scalar(select(CalendarAssignment.id))
        before_allocations = db.scalar(select(CalendarAllocation.id))
        line = db.scalar(select(TechnicalCardOperationLine).where(TechnicalCardOperationLine.tech_operation_id == 1))
        line.volume = Decimal("0")
        db.add(TechOperation(id=8, name="Без ресурса", code="bare", volume_unit=TechOperationVolumeUnit.PIECES, production_stage_id=3))
        db.add(ShopRoutingStageLine(
            id=17, routing_template_id=1, stage_order=8, production_stage_id=3, stage_label="Пусто", tech_operation_id=8,
        ))
        db.commit()
    body = client.get("/technical-cards/1/demand").json()
    assert demand(body, 11, "meter_press")["details"]["reason_code"] == "missing_linear_meters"
    bare = step(body, 17)
    assert bare["demands"] == [] and bare["status"] == "missing_input"
    assert bare["issues"][0]["reason_code"] == "missing_resource_link"
    assert client.get("/technical-cards/1/demand?routing_stage_line_id=99").status_code == 404
    assert client.post("/technical-cards/1/demand").status_code == 405
    with factory() as db:
        assert db.get(TechnicalCard, 1).updated_at == before_card
        assert db.scalar(select(CalendarAssignment.id)) == before_assignments
        assert db.scalar(select(CalendarAllocation.id)) == before_allocations
        assert db.get(TechnicalCardOrderGroup, group_id).desired_date == date(2026, 12, 1)
    assert writes == []


def test_second_sewing_step_does_not_reuse_the_same_norm(demand_client):
    client, factory, _, _ = demand_client
    with factory() as db:
        db.add(TechOperation(
            id=9, name="Пошив ещё раз", code="sew-again", volume_unit=TechOperationVolumeUnit.PIECES, production_stage_id=2,
        ))
        db.flush()
        db.add(ShopRoutingStageLine(
            id=18, routing_template_id=1, stage_order=9, production_stage_id=2, stage_label="Пошив 2", tech_operation_id=9,
        ))
        db.add(TechOperationCapacityResource(tech_operation_id=9, resource_key="sewers"))
        db.commit()
    body = client.get("/technical-cards/1/demand").json()
    assert demand(body, 10, "sewers")["amount"] == "200"
    other = demand(body, 18, "sewers")
    assert other["amount"] is None
    assert other["details"]["reason_code"] == "sewing_norm_unverified"
    assert other["routing_stage_line_id"] != 10


def test_zero_quantity_is_not_ready():
    snapshot = CardDemandSnapshot(
        technical_card_id=1, quantity=Decimal("0"), routing_template_id=1, sales_order_item_id=None,
        sewing_unverified=False, sewing_sources=(), applied_sewing=(), volumes=(),
        steps=(DemandStep(
            routing_stage_line_id=16, routing_template_id=1, stage_order=7, stage_label="Изделия",
            production_stage_id=3, operation_id=7, operation_name="Изделия", operation_stage_id=3,
            operation_volume_unit="pieces",
            resources=(ResourceView("item_gate", "rate", "item", "throughput", True),),
        ),),
    )
    result = calculate_demands(snapshot)
    assert result.steps[0].demands[0].status == "missing_input"
    assert result.steps[0].demands[0].details["reason_code"] == "invalid_quantity"
    assert result.steps[0].status == "missing_input"
