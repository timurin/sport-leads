"""Owned local PostgreSQL schemas only: reversible DDL and concurrent mapping."""

from concurrent.futures import ThreadPoolExecutor
from contextlib import contextmanager
from threading import Barrier
from uuid import uuid4

import pytest
from alembic.autogenerate import compare_metadata
from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import create_engine, event, text, select
from sqlalchemy.engine import make_url
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import sessionmaker

from app.config.settings import settings
from app.database.base import Base
from app.models.auth import PlatformUser
from app.models.sales import Employee, Organization
from app.models.audit import AuditEvent
from app.models.rbac import Role, Permission
from app.services.employee_user_link import change_employee_link, EmployeeLinkConflictError
from app.services.rbac import load_user_with_rbac, PERM_ADMIN_ROLES_ASSIGN
from tests.test_scheduler_migration_pc_04_1 import migration


@contextmanager
def owned_database():
    url = make_url(settings.database_url)
    if url.host not in {'localhost', '127.0.0.1'} or (url.port or 5432) != 5432:
        pytest.skip('ARCH-04A requires canonical local PostgreSQL :5432')
    schema = 'arch04a_' + uuid4().hex
    admin = create_engine(settings.database_url)
    engine = None
    try:
        with admin.begin() as connection:
            connection.execute(text('CREATE SCHEMA ' + schema))
        engine = create_engine(settings.database_url)
        @event.listens_for(engine, 'connect')
        def search_path(connection, _):
            with connection.cursor() as cursor:
                cursor.execute('SET search_path TO ' + schema)
            connection.commit()
        Base.metadata.create_all(engine)
        yield engine
    finally:
        if engine is not None:
            engine.dispose()
        assert schema.startswith('arch04a_') and len(schema.removeprefix('arch04a_')) == 32
        with admin.begin() as connection:
            connection.execute(text('DROP SCHEMA IF EXISTS ' + schema + ' CASCADE'))
        admin.dispose()


def test_migration_upgrade_downgrade_check_and_existing_data_preservation():
    revision = migration('arch04a_20261021_platform_user_employee_link.py')
    with owned_database() as engine:
        with engine.begin() as connection:
            revision.op = Operations(MigrationContext.configure(connection))
            revision.downgrade()  # Start with the exact pre-ARCH-04A schema.
            connection.execute(text("INSERT INTO organizations(id,name,is_active) VALUES(1,'HR',true)"))
            connection.execute(text("INSERT INTO employees(id,full_name,organization_id,is_active) VALUES(1,'Person',1,true)"))
            connection.execute(text("INSERT INTO platform_users(id,login,password_hash,display_name,is_active) VALUES"
                                    "(1,'legacy-one','untouched-hash','Person',true),(2,'legacy-two','other-hash','Person',false)"))
            connection.execute(text("INSERT INTO audit_events(action,entity_type,entity_id,actor_platform_user_id,source)"
                                    " VALUES('historical','test','1',1,'test')"))
            users_before = connection.execute(text('SELECT * FROM platform_users ORDER BY id')).mappings().all()
            employees_before = connection.execute(text('SELECT * FROM employees')).mappings().all()
            audit_before = connection.execute(text('SELECT * FROM audit_events')).mappings().all()
            for _ in range(2):
                revision.upgrade()
                users = connection.execute(text('SELECT * FROM platform_users ORDER BY id')).mappings().all()
                assert all(row['employee_id'] is None for row in users)
                assert [{k:v for k,v in row.items() if k != 'employee_id'} for row in users] == users_before
                connection.execute(text('UPDATE platform_users SET employee_id=1 WHERE id=1'))
                assert connection.execute(text('SELECT employee_id FROM platform_users WHERE id=1')).scalar() == 1
                for sql in [
                    'UPDATE platform_users SET employee_id=1 WHERE id=2',
                    'UPDATE platform_users SET employee_id=99999 WHERE id=2',
                    'DELETE FROM employees WHERE id=1',
                ]:
                    with pytest.raises(IntegrityError):
                        with connection.begin_nested():
                            connection.execute(text(sql))
                context = MigrationContext.configure(connection, opts={
                    'compare_type': False,
                    'include_object': lambda obj, name, kind, reflected, other: kind not in {'index', 'unique_constraint', 'check_constraint'},
                })
                assert compare_metadata(context, Base.metadata) == []
                revision.downgrade()
                assert connection.execute(text('SELECT * FROM platform_users ORDER BY id')).mappings().all() == users_before
                assert connection.execute(text('SELECT * FROM employees')).mappings().all() == employees_before
                assert connection.execute(text('SELECT * FROM audit_events')).mappings().all() == audit_before
            revision.upgrade()


def test_concurrent_link_has_one_winner_and_one_audit_event():
    with owned_database() as engine:
        factory = sessionmaker(bind=engine, expire_on_commit=False)
        with factory() as db:
            role = Role(code='linker', name='Linker', permissions=[Permission(code=PERM_ADMIN_ROLES_ASSIGN)])
            db.add(role)
            db.add(Organization(id=1, name='HR'))
            db.flush()
            db.add(Employee(id=1, full_name='Verified', organization_id=1))
            db.add_all([PlatformUser(id=1, login='actor', display_name='Actor', password_hash='unused', roles=[role]),
                        PlatformUser(id=2, login='one', display_name='Same', password_hash='unused'),
                        PlatformUser(id=3, login='two', display_name='Same', password_hash='unused')])
            db.commit()
        barrier = Barrier(2)
        def link(user_id):
            with factory() as db:
                actor = load_user_with_rbac(db, 1)
                barrier.wait(timeout=15)
                try:
                    change_employee_link(db, user_id, 1, actor=actor, reason='Verified match')
                    db.commit()
                    return 'linked'
                except EmployeeLinkConflictError:
                    db.rollback()
                    return 'conflict'
        with ThreadPoolExecutor(max_workers=2) as executor:
            assert sorted(executor.map(link, [2, 3])) == ['conflict', 'linked']
        with factory() as db:
            assert len(list(db.scalars(select(PlatformUser).where(PlatformUser.employee_id == 1)))) == 1
            assert len(list(db.scalars(select(AuditEvent)))) == 1
