"""Local PostgreSQL migration verification, isolated in a rolled-back schema."""
import importlib.util
from pathlib import Path
from uuid import uuid4

import pytest
from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url

from app.config.settings import settings


def migration(filename):
    path = Path(__file__).parents[1] / "alembic" / "versions" / filename
    spec = importlib.util.spec_from_file_location(filename, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_local_postgres_migration_preserves_settings_exceptions_and_shared_links():
    url = make_url(settings.database_url)
    if url.host not in {"localhost", "127.0.0.1"} or (url.port or 5432) != 5432:
        pytest.skip("Migration verification requires canonical local PostgreSQL :5432")
    engine = create_engine(settings.database_url)
    schema = "pc037a_" + uuid4().hex
    try:
        with engine.connect() as connection:
            transaction = connection.begin()
            try:
                connection.execute(text("CREATE SCHEMA " + schema))
                connection.execute(text("SET LOCAL search_path TO " + schema))
                connection.execute(text("CREATE TABLE production_stages (id integer PRIMARY KEY)"))
                connection.execute(text("CREATE TABLE work_centers (id integer PRIMARY KEY)"))
                connection.execute(text("CREATE TABLE tech_operations (id integer PRIMARY KEY, code varchar(64), production_stage_id integer)"))
                connection.execute(text("INSERT INTO production_stages VALUES (1),(3)"))
                connection.execute(text("INSERT INTO tech_operations VALUES (1,'sublimation',3),(2,'heat_transfer',3),(6,'design-op',1)"))
                old = migration("v1w2x3y4z567_production_capacity.py")
                new = migration("y4z5a6b7c890_shared_capacity_resources.py")
                old.op = new.op = Operations(MigrationContext.configure(connection))
                old.upgrade()
                connection.execute(text("INSERT INTO production_capacity_settings(resource_key,production_stage_id,staff_count,hours_per_day,working_days,note) VALUES ('print_operator',3,1,10,'[0,1,2,3,4]','Preserve'),('designers',1,1,10,'[0,1,2,3,4]',NULL)"))
                connection.execute(text("INSERT INTO production_capacity_exceptions(resource_key,date,capacity,unavailable,note) VALUES ('print_operator','2026-10-09',5,false,'Reduced')"))
                before = connection.execute(text("SELECT * FROM production_capacity_settings ORDER BY resource_key")).mappings().all()
                exceptions = connection.execute(text("SELECT * FROM production_capacity_exceptions")).mappings().all()
                for _ in range(2):
                    new.upgrade()
                    after = connection.execute(text("SELECT * FROM capacity_resources ORDER BY resource_key")).mappings().all()
                    assert [{key: row[key] for key in original} for row, original in zip(after, before)] == before
                    assert len(after) == 2
                    assert connection.execute(text("SELECT tech_operation_id FROM tech_operation_capacity_resources WHERE resource_key='print_operator' ORDER BY tech_operation_id")).scalars().all() == [1, 2]
                    assert connection.execute(text("SELECT * FROM production_capacity_exceptions")).mappings().all() == exceptions
                    new.downgrade()
                    assert connection.execute(text("SELECT * FROM production_capacity_settings ORDER BY resource_key")).mappings().all() == before
                    assert connection.execute(text("SELECT * FROM production_capacity_exceptions")).mappings().all() == exceptions
                new.upgrade()
            finally:
                transaction.rollback()
    finally:
        engine.dispose()
