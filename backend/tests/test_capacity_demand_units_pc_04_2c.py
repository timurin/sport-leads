"""Local PostgreSQL migration for PC-04.2C, isolated in a rolled-back schema."""
from datetime import date
from uuid import uuid4

import pytest
from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url

from app.config.settings import settings
from tests.test_scheduler_migration_pc_04_1 import migration


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
            work_center_id integer,
            norm_rates jsonb NOT NULL DEFAULT '{}'::jsonb
        )
        """
    ))
    connection.execute(text(
        """
        CREATE TABLE tech_operations (
            id integer PRIMARY KEY,
            code varchar(64) NOT NULL
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
    revision = migration("a6b7c8d9e012_capacity_demand_units.py")
    connection.execute(text(
        "ALTER TABLE capacity_resources ADD CONSTRAINT ck_capacity_resource_unit CHECK ("
        + revision.PREVIOUS_UNIT_CHECK
        + ")"
    ))
    connection.execute(text(
        """
        INSERT INTO capacity_resources
            (resource_key, resource_type, capacity_unit, calculation_mode, base_rate, staff_count, norm_rates)
        VALUES
            ('plotter_1', 'machine', 'machine_hour', 'rate', 15, NULL, '{"running_meters_per_hour": "15"}'),
            ('plotter_3', 'machine', 'machine_hour', 'rate', 12, NULL, '{"running_meters_per_hour": "12"}'),
            ('calender', 'machine', 'machine_hour', 'rate', 60, NULL, '{"running_meters_per_hour": "60"}'),
            ('laser', 'machine', 'machine_hour', 'rate', 100, NULL, '{"items_per_machine_hour": "100"}'),
            ('cutters', 'labor', 'labor_hour', 'cutting_methods', NULL, 2,
             '{"manual_single_items_per_person_hour": "20", "manual_lay_items_per_person_hour": "40"}'),
            ('packing_team', 'labor', 'team_hour', 'team_rate', 80, 6, '{"items_per_team_hour": "80"}'),
            ('sewers', 'labor', 'labor_hour', 'sewing_norm', NULL, 4, '{}'),
            ('print_operator', 'labor', 'labor_hour', 'explicit_hours', NULL, 1, '{}'),
            ('calender_operator', 'labor', 'labor_hour', 'explicit_hours', NULL, 1, '{}'),
            ('designers', 'labor', 'labor_hour', 'explicit_hours', NULL, 1, '{}'),
            ('procurement', 'milestone', NULL, 'milestone', NULL, NULL, '{}'),
            ('printer', 'machine', 'machine_hour', 'rate', 15, NULL, '{}')
        """
    ))
    connection.execute(text("INSERT INTO tech_operations VALUES (1, 'sublimation')"))
    connection.execute(text(
        "INSERT INTO tech_operation_capacity_resources VALUES (1, 'plotter_1'), (1, 'packing_team')"
    ))
    connection.execute(text(
        "INSERT INTO production_capacity_exceptions VALUES ('plotter_1', :day, 8, false)"
    ), {"day": date(2026, 10, 7)})
    return revision


def units(connection):
    rows = connection.execute(text(
        """
        SELECT resource_key, resource_type, capacity_unit, calculation_mode, base_rate, staff_count, norm_rates::text
        FROM capacity_resources
        ORDER BY resource_key
        """
    )).mappings().all()
    return {row["resource_key"]: row for row in rows}


def test_catalog_units_align_without_rewriting_links_rates_or_exceptions():
    engine = engine_or_skip()
    schema = "pc042c_" + uuid4().hex[:12]
    try:
        with engine.connect() as connection:
            transaction = connection.begin()
            try:
                revision = prepare(connection, schema)
                revision.op = Operations(MigrationContext.configure(connection))
                revision.upgrade()
                aligned = units(connection)
                assert aligned["plotter_1"]["capacity_unit"] == "linear_meter"
                assert aligned["plotter_1"]["base_rate"] == 15
                assert aligned["plotter_1"]["staff_count"] is None
                assert aligned["plotter_3"]["capacity_unit"] == "linear_meter"
                assert aligned["plotter_3"]["base_rate"] == 12
                assert aligned["calender"]["capacity_unit"] == "linear_meter"
                assert aligned["calender"]["base_rate"] == 60
                assert aligned["laser"]["capacity_unit"] == "item"
                assert aligned["laser"]["base_rate"] == 100
                assert aligned["laser"]["staff_count"] is None
                assert aligned["cutters"]["capacity_unit"] == "item"
                assert aligned["cutters"]["calculation_mode"] == "cutting_methods"
                assert aligned["cutters"]["base_rate"] is None
                assert "manual_lay_items_per_person_hour" in aligned["cutters"]["norm_rates"]
                assert aligned["packing_team"]["capacity_unit"] == "item"
                assert aligned["packing_team"]["calculation_mode"] == "team_rate"
                assert aligned["packing_team"]["base_rate"] == 80
                assert aligned["packing_team"]["staff_count"] == 1
                assert aligned["sewers"]["capacity_unit"] == "labor_hour"
                assert aligned["print_operator"]["calculation_mode"] == "explicit_hours"
                assert aligned["calender_operator"]["capacity_unit"] == "labor_hour"
                assert aligned["designers"]["capacity_unit"] == "labor_hour"
                assert aligned["procurement"]["capacity_unit"] is None
                assert aligned["printer"]["capacity_unit"] == "machine_hour"
                assert connection.execute(text(
                    "SELECT tech_operation_id, resource_key FROM tech_operation_capacity_resources ORDER BY resource_key"
                )).all() == [(1, "packing_team"), (1, "plotter_1")]
                exception = connection.execute(text(
                    'SELECT capacity, unavailable FROM production_capacity_exceptions WHERE resource_key = \'plotter_1\''
                )).one()
                assert exception.capacity == 8 and exception.unavailable is False
                revision.downgrade()
                restored = units(connection)
                assert restored["plotter_1"]["capacity_unit"] == "machine_hour"
                assert restored["plotter_3"]["base_rate"] == 12
                assert restored["calender"]["capacity_unit"] == "machine_hour"
                assert restored["laser"]["capacity_unit"] == "machine_hour"
                assert restored["cutters"]["capacity_unit"] == "labor_hour"
                assert restored["packing_team"]["capacity_unit"] == "team_hour"
                assert restored["packing_team"]["staff_count"] == 2
                assert connection.execute(text(
                    "SELECT capacity FROM production_capacity_exceptions WHERE resource_key = 'plotter_1'"
                )).scalar() == 8
                revision.upgrade()
                assert units(connection)["plotter_1"]["capacity_unit"] == "linear_meter"
                assert units(connection)["packing_team"]["staff_count"] == 1
                assert connection.execute(text(
                    "SELECT count(*) FROM tech_operation_capacity_resources"
                )).scalar() == 2
            finally:
                transaction.rollback()
    finally:
        engine.dispose()
