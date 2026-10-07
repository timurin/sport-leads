"""Local PostgreSQL migration for PC-04.1, isolated in a rolled-back schema."""
import importlib.util
from pathlib import Path
from uuid import uuid4

import pytest
from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url
from sqlalchemy.exc import IntegrityError

from app.config.settings import settings


def migration(filename):
    path = Path(__file__).parents[1] / "alembic" / "versions" / filename
    spec = importlib.util.spec_from_file_location(filename, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def engine_or_skip():
    url = make_url(settings.database_url)
    if url.host not in {"localhost", "127.0.0.1"} or (url.port or 5432) != 5432:
        pytest.skip("Migration verification requires canonical local PostgreSQL :5432")
    return create_engine(settings.database_url)


def prepare(connection, schema, *, lines):
    connection.execute(text("CREATE SCHEMA " + schema))
    connection.execute(text("SET LOCAL search_path TO " + schema))
    connection.execute(text(
        "CREATE TABLE platform_system_settings (id integer PRIMARY KEY, default_timezone varchar(64) NOT NULL)"
    ))
    connection.execute(text("INSERT INTO platform_system_settings VALUES (1, 'Europe/Moscow')"))
    connection.execute(text(
        "CREATE TABLE technical_card_order_groups (id integer PRIMARY KEY, desired_date date NOT NULL)"
    ))
    connection.execute(text("INSERT INTO technical_card_order_groups VALUES (1, '2026-12-01')"))
    connection.execute(text(
        "CREATE TABLE technical_cards (id integer PRIMARY KEY, number varchar(80) NOT NULL, "
        "created_at timestamptz NOT NULL, routing_template_id integer, order_group_id integer)"
    ))
    connection.execute(text(
        "INSERT INTO technical_cards VALUES (1, 'TC-1', '2026-10-06 22:30:00+00', 10, 1)"
    ))
    connection.execute(text(
        "CREATE TABLE shop_routing_stage_lines (id integer PRIMARY KEY, routing_template_id integer NOT NULL, "
        "production_stage_id integer)"
    ))
    connection.execute(text("INSERT INTO shop_routing_stage_lines (id, routing_template_id, production_stage_id) VALUES " + lines))
    connection.execute(text(
        "CREATE TABLE calendar_assignments (id integer PRIMARY KEY, technical_card_id integer NOT NULL, "
        "production_stage_id integer NOT NULL, planned_date date NOT NULL, planned_end_date date NOT NULL, "
        "position integer NOT NULL, note text, created_at timestamptz, updated_at timestamptz, "
        "CONSTRAINT uq_calendar_assignment_card_stage UNIQUE (technical_card_id, production_stage_id))"
    ))
    connection.execute(text(
        "INSERT INTO calendar_assignments VALUES "
        "(1, 1, 5, '2026-10-05', '2026-10-05', 0, NULL, '2026-10-06 22:30:00+00', '2026-10-06 22:30:00+00'), "
        "(2, 1, 7, '2026-10-06', '2026-10-06', 0, NULL, '2026-10-06 22:30:00+00', '2026-10-06 22:30:00+00')"
    ))
    connection.execute(text("CREATE TABLE capacity_resources (resource_key varchar(64) PRIMARY KEY)"))


def card_columns(connection, schema):
    return set(connection.execute(text(
        "SELECT column_name FROM information_schema.columns "
        "WHERE table_schema = :schema AND table_name = 'technical_cards'"
    ), {"schema": schema}).scalars().all())


def test_upgrade_downgrade_upgrade_preserves_cards_and_assignments():
    engine = engine_or_skip()
    schema = "pc041_" + uuid4().hex
    revision = migration("z5a6b7c8d901_scheduler_data_prerequisites.py")
    try:
        with engine.connect() as connection:
            transaction = connection.begin()
            try:
                prepare(connection, schema, lines="(100, 10, 7), (101, 10, NULL), (102, 99, 7)")
                revision.op = Operations(MigrationContext.configure(connection))
                for _ in range(2):
                    revision.upgrade()
                    card = connection.execute(text("SELECT * FROM technical_cards WHERE id = 1")).mappings().one()
                    assert str(card["planning_start_date"]) == "2026-10-07"
                    assert card["shipping_date"] is None
                    assert card["priority"] is None
                    assert card["plan_locked"] is False
                    assert card["number"] == "TC-1"
                    assert connection.execute(text("SELECT desired_date FROM technical_card_order_groups")).scalar() == date_value("2026-12-01")
                    rows = connection.execute(text(
                        "SELECT id, routing_stage_line_id, planning_mode, manual_lock FROM calendar_assignments ORDER BY id"
                    )).mappings().all()
                    assert [row["id"] for row in rows] == [1, 2]
                    assert rows[0]["routing_stage_line_id"] is None
                    assert rows[1]["routing_stage_line_id"] == 100
                    assert [row["planning_mode"] for row in rows] == ["manual_adjusted", "manual_adjusted"]
                    assert [row["manual_lock"] for row in rows] == [True, True]
                    revision.downgrade()
                    assert "planning_start_date" not in card_columns(connection, schema)
                    assert "shipping_date" not in card_columns(connection, schema)
                    assert connection.execute(text("SELECT id FROM calendar_assignments ORDER BY id")).scalars().all() == [1, 2]
                    assert connection.execute(text("SELECT desired_date FROM technical_card_order_groups")).scalar() == date_value("2026-12-01")
                revision.upgrade()
                connection.execute(text("INSERT INTO capacity_resources VALUES ('sewers'), ('plotter_1')"))
                connection.execute(text(
                    "INSERT INTO calendar_allocations (assignment_id, resource_key, \"date\", allocated_amount, capacity_unit) VALUES "
                    "(2, 'sewers', '2026-10-07', 1.5, 'labor_hour'), "
                    "(2, 'sewers', '2026-10-08', 2, 'labor_hour'), "
                    "(2, 'plotter_1', '2026-10-07', 15, 'linear_meter')"
                ))
                stored = connection.execute(text(
                    "SELECT resource_key, \"date\", allocated_amount, capacity_unit FROM calendar_allocations ORDER BY \"date\", resource_key"
                )).mappings().all()
                assert [(row["resource_key"], str(row["date"]), row["capacity_unit"]) for row in stored] == [
                    ("plotter_1", "2026-10-07", "linear_meter"),
                    ("sewers", "2026-10-07", "labor_hour"),
                    ("sewers", "2026-10-08", "labor_hour"),
                ]
                connection.execute(text("SAVEPOINT alloc"))
                with pytest.raises(IntegrityError):
                    connection.execute(text(
                        "INSERT INTO calendar_allocations (assignment_id, resource_key, \"date\", allocated_amount, capacity_unit) "
                        "VALUES (2, 'sewers', '2026-10-07', 1, 'labor_hour')"
                    ))
                connection.execute(text("ROLLBACK TO SAVEPOINT alloc"))
                connection.execute(text("DELETE FROM calendar_assignments WHERE id = 2"))
                assert connection.execute(text("SELECT count(*) FROM calendar_allocations")).scalar() == 0
                assert connection.execute(text("SELECT id FROM calendar_assignments")).scalar() == 1
            finally:
                transaction.rollback()
    finally:
        engine.dispose()


def test_ambiguous_route_step_stops_the_migration():
    engine = engine_or_skip()
    schema = "pc041a_" + uuid4().hex
    revision = migration("z5a6b7c8d901_scheduler_data_prerequisites.py")
    try:
        with engine.connect() as connection:
            transaction = connection.begin()
            try:
                prepare(connection, schema, lines="(100, 10, 7), (103, 10, 7)")
                revision.op = Operations(MigrationContext.configure(connection))
                with pytest.raises(RuntimeError, match="Cannot map calendar assignments"):
                    revision.upgrade()
            finally:
                transaction.rollback()
    finally:
        engine.dispose()


def test_downgrade_refuses_to_drop_two_steps_on_one_stage():
    engine = engine_or_skip()
    schema = "pc041b_" + uuid4().hex
    revision = migration("z5a6b7c8d901_scheduler_data_prerequisites.py")
    try:
        with engine.connect() as connection:
            transaction = connection.begin()
            try:
                prepare(connection, schema, lines="(100, 10, 7)")
                revision.op = Operations(MigrationContext.configure(connection))
                revision.upgrade()
                connection.execute(text(
                    "INSERT INTO shop_routing_stage_lines VALUES (104, 10, 7)"
                ))
                connection.execute(text(
                    "INSERT INTO calendar_assignments "
                    "(id, technical_card_id, production_stage_id, routing_stage_line_id, planned_date, planned_end_date, "
                    "position, planning_mode, manual_lock) "
                    "VALUES (3, 1, 7, 104, '2026-10-11', '2026-10-11', 0, 'auto', false)"
                ))
                assert connection.execute(text("SELECT count(*) FROM calendar_assignments")).scalar() == 3
                connection.execute(text("SAVEPOINT before_down"))
                with pytest.raises(RuntimeError, match="Cannot restore one assignment"):
                    revision.downgrade()
                connection.execute(text("ROLLBACK TO SAVEPOINT before_down"))
                assert connection.execute(text("SELECT count(*) FROM calendar_assignments")).scalar() == 3
            finally:
                transaction.rollback()
    finally:
        engine.dispose()


def date_value(iso):
    from datetime import date
    year, month, day = (int(part) for part in iso.split("-"))
    return date(year, month, day)
