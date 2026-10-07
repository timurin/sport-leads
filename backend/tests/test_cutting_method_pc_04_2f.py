"""PC-04.2F: manual cutting method and unambiguous capacity links."""
from decimal import Decimal
from uuid import uuid4

import pytest
from alembic.migration import MigrationContext
from alembic.operations import Operations
from pydantic import ValidationError
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url

from app.config.settings import settings
from app.schemas.technical_card import TechnicalCardOperationLineWrite
from app.services.production_demand import calculate_demands
from app.services.production_demand_snapshot import (
    AppliedSewingRow,
    CardDemandSnapshot,
    DemandStep,
    ResourceView,
    SewingSource,
    VolumeRow,
)
from app.services.technical_cards import TechnicalCardValidationError, _assert_cutting_method
from tests.test_scheduler_migration_pc_04_1 import migration


RATES = {
    "manual_single_items_per_person_hour": "20",
    "manual_lay_items_per_person_hour": "40",
}


def line(**extra):
    payload = {
        "sequence": 1,
        "operation_name": "Ручной раскрой",
        "volume_unit": "pieces",
    }
    payload.update(extra)
    return TechnicalCardOperationLineWrite(**payload)


def card(code, method, resource, *, quantity=Decimal("1000"), volumes=None):
    rows = volumes if volumes is not None else (
        VolumeRow(
            id=1,
            tech_operation_id=8,
            stage_order=4,
            production_stage_id=2,
            volume=Decimal("0"),
            volume_unit="pieces",
            cutting_method=method,
        ),
    )
    return CardDemandSnapshot(
        technical_card_id=1,
        quantity=quantity,
        routing_template_id=1,
        sales_order_item_id=None,
        sewing_unverified=False,
        sewing_sources=(),
        applied_sewing=(),
        volumes=rows,
        steps=(DemandStep(
            routing_stage_line_id=8,
            routing_template_id=1,
            stage_order=4,
            stage_label="Раскрой",
            production_stage_id=2,
            operation_id=8,
            operation_name="Ручной раскрой",
            operation_stage_id=2,
            operation_volume_unit="pieces",
            resources=(resource,),
            operation_code=code,
        ),),
    )


def cutters(rates=RATES):
    return ResourceView("cutters", "cutting_methods", "item", "labor", True, rates)


def demand_of(snapshot):
    return calculate_demands(snapshot).steps[0].demands[0]


def test_cutting_method_accepts_only_manual_modes():
    assert line(cutting_method="manual_single").cutting_method == "manual_single"
    assert line(cutting_method="manual_lay").cutting_method == "manual_lay"
    assert line().cutting_method is None
    with pytest.raises(ValidationError):
        line(cutting_method="laser")
    _assert_cutting_method("manual_single", "manual-cut")
    _assert_cutting_method(None, "opt-cut")
    with pytest.raises(TechnicalCardValidationError):
        _assert_cutting_method("manual_lay", "laser")
    with pytest.raises(TechnicalCardValidationError):
        _assert_cutting_method("manual_single", "opt-cut")


def test_manual_cut_uses_the_selected_rate_without_converting_to_hours():
    single = demand_of(card("manual-cut", "manual_single", cutters()))
    assert single.status == "ready"
    assert single.amount == "1000" and single.unit == "item"
    assert single.details["cutting_method"] == "manual_single"
    assert single.details["items_per_person_hour"] == "20"
    lay = demand_of(card("manual-cut", "manual_lay", cutters()))
    assert lay.status == "ready" and lay.amount == "1000"
    assert lay.details["cutting_method"] == "manual_lay"
    assert lay.details["items_per_person_hour"] == "40"
    missing = demand_of(card("manual-cut", None, cutters()))
    assert missing.status == "manual_required"
    assert missing.amount is None
    assert missing.details["reason_code"] == "missing_cutting_mode"
    without_rate = demand_of(card("manual-cut", "manual_single", cutters({})))
    assert without_rate.status == "missing_input"
    assert without_rate.details["reason_code"] == "missing_cutting_rate"


def test_laser_opt_cut_sewing_and_packing_ignore_the_cutting_selector():
    laser = demand_of(card(
        "laser",
        "manual_single",
        ResourceView("laser", "rate", "item", "machine", True, {"items_per_machine_hour": "100"}),
    ))
    assert laser.status == "ready" and laser.amount == "1000" and laser.unit == "item"
    assert laser.details["adapter"] == "item_throughput"
    opt = demand_of(card("opt-cut", "manual_single", cutters()))
    assert opt.status == "manual_required"
    assert opt.details["reason_code"] == "missing_cutting_mode"
    packing = demand_of(card(
        "packaging",
        None,
        ResourceView("packing_team", "team_rate", "item", "labor", True, {"items_per_team_hour": "80"}),
    ))
    assert packing.status == "ready" and packing.amount == "1000" and packing.unit == "item"
    sewing = CardDemandSnapshot(
        technical_card_id=1,
        quantity=Decimal("1000"),
        routing_template_id=1,
        sales_order_item_id=None,
        sewing_unverified=False,
        sewing_sources=(SewingSource(11, 5, "Стачать", 720, 1, "assembly_operation_lines"),),
        applied_sewing=(AppliedSewingRow(101, 5, "Стачать", 1, 2),),
        volumes=(),
        steps=(DemandStep(
            routing_stage_line_id=10,
            routing_template_id=1,
            stage_order=1,
            stage_label="Пошив",
            production_stage_id=2,
            operation_id=3,
            operation_name="Пошив",
            operation_stage_id=2,
            operation_volume_unit="pieces",
            resources=(ResourceView("sewers", "sewing_norm", "labor_hour", "labor", True),),
            operation_code="sewing",
        ),),
    )
    sewers = demand_of(sewing)
    assert sewers.status == "ready" and sewers.amount == "200" and sewers.unit == "labor_hour"


def test_zero_linear_meters_stay_missing_input():
    snapshot = card(
        "sublimation",
        None,
        ResourceView("plotter_1", "rate", "linear_meter", "machine", True),
        volumes=(VolumeRow(
            id=4,
            tech_operation_id=8,
            stage_order=4,
            production_stage_id=2,
            volume=Decimal("0"),
            volume_unit="linear_meters",
        ),),
    )
    meters = demand_of(snapshot)
    assert meters.status == "missing_input"
    assert meters.details["reason_code"] == "missing_linear_meters"
    assert meters.amount is None


def engine_or_skip():
    url = make_url(settings.database_url)
    if url.host not in {"localhost", "127.0.0.1"} or (url.port or 5432) != 5432:
        pytest.skip("Migration verification requires canonical local PostgreSQL :5432")
    return create_engine(settings.database_url)


def prepare(connection, schema):
    connection.execute(text("CREATE SCHEMA " + schema))
    connection.execute(text("SET LOCAL search_path TO " + schema))
    connection.execute(text(
        """
        CREATE TABLE capacity_resources (
            resource_key varchar(64) PRIMARY KEY,
            name varchar(255),
            resource_type varchar(20) NOT NULL,
            capacity_unit varchar(20),
            calculation_mode varchar(32) NOT NULL,
            base_rate numeric(14,4),
            staff_count integer,
            hours_per_day numeric(14,4),
            shifts_per_day integer NOT NULL DEFAULT 1,
            efficiency numeric(8,4) NOT NULL DEFAULT 1,
            include_in_calendar_load boolean NOT NULL DEFAULT true,
            work_center_id integer,
            norm_rates jsonb NOT NULL DEFAULT '{}'::jsonb,
            production_stage_id integer,
            working_days jsonb NOT NULL DEFAULT '[0,1,2,3,4]'::jsonb
        )
        """
    ))
    unit_check = migration("a6b7c8d9e012_capacity_demand_units.py").UNIT_CHECK
    connection.execute(text(
        "ALTER TABLE capacity_resources ADD CONSTRAINT ck_capacity_resource_unit CHECK ("
        + unit_check
        + ")"
    ))
    connection.execute(text(
        """
        CREATE TABLE tech_operations (
            id integer PRIMARY KEY,
            code varchar(64) NOT NULL,
            production_stage_id integer
        )
        """
    ))
    connection.execute(text(
        """
        CREATE TABLE tech_operation_capacity_resources (
            tech_operation_id integer NOT NULL REFERENCES tech_operations(id),
            resource_key varchar(64) NOT NULL REFERENCES capacity_resources(resource_key),
            PRIMARY KEY (tech_operation_id, resource_key)
        )
        """
    ))
    connection.execute(text(
        """
        CREATE TABLE production_capacity_exceptions (
            resource_key varchar(64) NOT NULL REFERENCES capacity_resources(resource_key),
            "date" date NOT NULL,
            capacity numeric(14,4),
            unavailable boolean NOT NULL,
            PRIMARY KEY (resource_key, "date")
        )
        """
    ))
    connection.execute(text(
        """
        CREATE TABLE technical_card_operation_lines (
            id integer PRIMARY KEY,
            volume numeric(14,3) NOT NULL
        )
        """
    ))
    connection.execute(text(
        """
        INSERT INTO tech_operations (id, code, production_stage_id) VALUES
            (1, 'sublimation', 3),
            (2, 'heat_transfer', 3),
            (3, 'sewing', 4),
            (5, 'packaging', 6),
            (6, 'design-op', 1),
            (7, 'laser', 2),
            (8, 'manual-cut', 2),
            (9, 'opt-cut', 2)
        """
    ))
    connection.execute(text(
        """
        INSERT INTO capacity_resources
            (resource_key, name, resource_type, capacity_unit, calculation_mode)
        VALUES
            ('print_operator', 'Оператор печати', 'labor', 'labor_hour', 'explicit_hours'),
            ('designers', 'Дизайнеры', 'labor', 'labor_hour', 'explicit_hours')
        """
    ))
    connection.execute(text(
        """
        INSERT INTO tech_operation_capacity_resources (tech_operation_id, resource_key) VALUES
            (1, 'print_operator'),
            (2, 'print_operator'),
            (6, 'designers')
        """
    ))
    connection.execute(text(
        "INSERT INTO technical_card_operation_lines (id, volume) VALUES (1, 0)"
    ))
    return migration("f2a3b4c5d6e7_cutting_method_resource_links.py")


def links(connection):
    rows = connection.execute(text(
        """
        SELECT tech_operations.code, link.resource_key
        FROM tech_operation_capacity_resources AS link
        JOIN tech_operations ON tech_operations.id = link.tech_operation_id
        ORDER BY tech_operations.code, link.resource_key
        """
    )).all()
    return [(row[0], row[1]) for row in rows]


def test_unambiguous_links_are_added_and_shared_resources_stay_single():
    engine = engine_or_skip()
    schema = "pc042f_" + uuid4().hex[:12]
    try:
        with engine.connect() as connection:
            transaction = connection.begin()
            try:
                revision = prepare(connection, schema)
                revision.op = Operations(MigrationContext.configure(connection))
                revision.upgrade()
                stored = connection.execute(text(
                    "SELECT cutting_method FROM technical_card_operation_lines"
                )).scalar()
                assert stored is None
                assert links(connection) == [
                    ("design-op", "designers"),
                    ("heat_transfer", "print_operator"),
                    ("laser", "laser"),
                    ("manual-cut", "cutters"),
                    ("packaging", "packing_team"),
                    ("sewing", "sewers"),
                    ("sublimation", "print_operator"),
                ]
                keys = connection.execute(text(
                    "SELECT resource_key FROM capacity_resources ORDER BY resource_key"
                )).scalars().all()
                assert keys == ["cutters", "designers", "laser", "packing_team", "print_operator", "sewers"]
                assert connection.execute(text(
                    "SELECT count(*) FROM capacity_resources WHERE resource_key = 'print_operator'"
                )).scalar() == 1
                cutters_row = connection.execute(text(
                    """
                    SELECT capacity_unit, calculation_mode, norm_rates::text
                    FROM capacity_resources WHERE resource_key = 'cutters'
                    """
                )).one()
                assert cutters_row[0] == "item" and cutters_row[1] == "cutting_methods"
                assert "manual_single_items_per_person_hour" in cutters_row[2]
                revision.downgrade()
                assert "cutting_method" not in connection.execute(text(
                    """
                    SELECT column_name FROM information_schema.columns
                    WHERE table_schema = current_schema()
                      AND table_name = 'technical_card_operation_lines'
                    """
                )).scalars().all()
                assert links(connection) == [
                    ("design-op", "designers"),
                    ("heat_transfer", "print_operator"),
                    ("sublimation", "print_operator"),
                ]
                revision.upgrade()
                assert ("manual-cut", "cutters") in links(connection)
                assert ("sewing", "sewers") in links(connection)
            finally:
                transaction.rollback()
    finally:
        engine.dispose()
