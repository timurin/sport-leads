"""Explicit Employee/account mapping: identity only, no access side effects."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database.base import Base
from app.database.session import get_db
from app.main import app
from app.models.auth import PlatformUser, AuthSession
from app.models.audit import AuditEvent
from app.models.sales import Organization, Employee
from app.services import employee_user_link as service
from app.services.rbac import load_user_with_rbac, permission_codes_for_user
from tests.auth_test_helpers import ensure_user_with_role, login_client
from tests.test_production_scheduler_pc_04_3a import scheduler, run


@pytest.fixture
def workspace():
    engine = create_engine('sqlite+pysqlite://', connect_args={'check_same_thread': False}, poolclass=StaticPool)

    @event.listens_for(engine, 'connect')
    def foreign_keys(connection, _):
        connection.execute('PRAGMA foreign_keys=ON')

    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, expire_on_commit=False)
    with factory() as db:
        admin = ensure_user_with_role(db, login='admin04a', role_code='admin')
        target = ensure_user_with_role(db, login='target04a', role_code='shop_operator')
        other = ensure_user_with_role(db, login='other04a', role_code='shop_operator')
        org = Organization(name='ARCH-04A')
        db.add(org)
        db.flush()
        db.add_all([Employee(id=1, full_name='Person', organization_id=org.id),
                    Employee(id=2, full_name='Other person', organization_id=org.id)])
        db.commit()

    def session():
        with factory() as db:
            yield db

    previous = dict(app.dependency_overrides)
    app.dependency_overrides[get_db] = session
    try:
        with TestClient(app) as api:
            login_client(api, login='admin04a')
            yield api, factory, admin, target, other
    finally:
        app.dependency_overrides.clear()
        app.dependency_overrides.update(previous)
        engine.dispose()


def post(api, user, employee=1, *, unlink=False):
    suffix = 'employee-unlink' if unlink else 'employee-link'
    key = 'expected_employee_id' if unlink else 'employee_id'
    return api.post(f'/platform-users/{user}/{suffix}', json={key: employee, 'reason': 'Owner verified IDs'})


def audit_rows(db):
    return list(db.scalars(select(AuditEvent).where(AuditEvent.action.like('platform_user.employee_%')).order_by(AuditEvent.id)))


def test_link_reload_list_unlink_idempotency_and_audit(workspace):
    api, factory, admin, target, _ = workspace
    path = f'/platform-users/{target}/employee-link'
    assert api.get(path).json() == {'platform_user_id': target, 'employee_id': None}
    for _ in range(2):
        response = post(api, target)
        assert response.status_code == 200, response.text
        assert response.json() == {'platform_user_id': target, 'employee_id': 1}
    assert api.get(path).json()['employee_id'] == 1
    rows = api.get('/platform-users').json()['items']
    assert next(row for row in rows if row['id'] == target)['employee_id'] == 1
    with factory() as db:
        events = audit_rows(db)
        assert len(events) == 1
        assert events[0].actor_platform_user_id == admin
        assert events[0].actor_login == 'admin04a'
        assert events[0].entity_id == str(target)
        assert events[0].payload == {'before': {'employee_id': None}, 'after': {'employee_id': 1}, 'reason': 'Owner verified IDs'}
    for _ in range(2):
        assert post(api, target, unlink=True).json()['employee_id'] is None
    with factory() as db:
        events = audit_rows(db)
        assert [row.action for row in events] == ['platform_user.employee_linked', 'platform_user.employee_unlinked']
        assert events[-1].payload['before'] == {'employee_id': 1}
        assert db.get(Employee, 1) is not None


def test_conflicts_and_stale_unlink_do_not_reassign_or_write_audit(workspace):
    api, factory, _, target, other = workspace
    assert post(api, target).status_code == 200
    assert post(api, other).status_code == 409
    assert post(api, target, 2).status_code == 409
    assert post(api, target, 2, unlink=True).status_code == 409
    assert post(api, target, unlink=True).status_code == 200
    assert post(api, target, 2).status_code == 200
    assert post(api, target, 1, unlink=True).status_code == 409
    with factory() as db:
        assert db.get(PlatformUser, target).employee_id == 2
        assert db.get(PlatformUser, other).employee_id is None
        assert len(audit_rows(db)) == 3


@pytest.mark.parametrize('suffix,body', [
    ('employee-link', {}), ('employee-link', {'employee_id': 0, 'reason': 'bad'}),
    ('employee-link', {'employee_id': 1, 'reason': '  '}),
    ('employee-link', {'employee_id': 1, 'reason': 'ok', 'role_codes': ['admin']}),
    ('employee-unlink', {'reason': 'missing expected ID'}),
])
def test_validation(workspace, suffix, body):
    api, _, _, target, _ = workspace
    assert api.post(f'/platform-users/{target}/{suffix}', json=body).status_code == 422


def test_missing_and_permissions(workspace):
    api, factory, _, target, _ = workspace
    assert post(api, 99999).status_code == 404
    assert post(api, target, 99999).status_code == 404
    assert api.get('/platform-users/99999/employee-link').status_code == 404
    with TestClient(app) as anonymous:
        assert post(anonymous, target).status_code == 401
        assert anonymous.get(f'/platform-users/{target}/employee-link').status_code == 401
        login_client(anonymous, login='target04a')
        assert post(anonymous, target).status_code == 403
        assert post(anonymous, target, unlink=True).status_code == 403
        assert anonymous.get(f'/platform-users/{target}/employee-link').status_code == 403
    with factory() as db:
        assert db.get(PlatformUser, target).employee_id is None
        assert not audit_rows(db)


def test_employee_and_account_creation_remain_independent(workspace):
    api, factory, _, _, _ = workspace
    with factory() as db:
        org = db.scalar(select(Organization.id))
    created = api.post('/employees', json={'full_name': 'No account', 'organization_id': org})
    assert created.status_code == 201, created.text
    invited = api.post('/platform-users/invite', json={'login': 'unmapped04a', 'display_name': 'No account'})
    assert invited.status_code == 201, invited.text
    with factory() as db:
        user = db.get(PlatformUser, invited.json()['user']['id'])
        assert user.employee_id is None
        assert db.scalar(select(PlatformUser.id).where(PlatformUser.employee_id == created.json()['id'])) is None


def test_mapping_does_not_modify_profile_rbac_password_sessions_or_auth(workspace):
    api, factory, _, target, _ = workspace
    with TestClient(app) as user_api:
        login_client(user_api, login='target04a')
        before_me = user_api.get('/auth/me').json()
        with factory() as db:
            user = load_user_with_rbac(db, target)
            before = {c.name: getattr(user, c.name) for c in PlatformUser.__table__.columns if c.name not in {'employee_id', 'updated_at', 'last_activity_at'}}
            perms = permission_codes_for_user(user)
            sessions = [(r.id, r.revoked_at, r.token_hash) for r in db.scalars(select(AuthSession).where(AuthSession.platform_user_id == target))]
        assert post(api, target).status_code == 200
        after_me = user_api.get('/auth/me').json()
        assert {k:v for k,v in before_me.items() if k != 'last_activity_at'} == {k:v for k,v in after_me.items() if k != 'last_activity_at'}
        assert post(api, target, unlink=True).status_code == 200
        with factory() as db:
            user = load_user_with_rbac(db, target)
            assert {key: getattr(user, key) for key in before} == before
            assert permission_codes_for_user(user) == perms
            assert [(r.id, r.revoked_at, r.token_hash) for r in db.scalars(select(AuthSession).where(AuthSession.platform_user_id == target))] == sessions


def test_database_unique_restrict_and_nulls(workspace):
    api, factory, _, target, other = workspace
    assert post(api, target).status_code == 200
    with factory() as db:
        with pytest.raises(IntegrityError):
            with db.begin_nested():
                db.get(PlatformUser, other).employee_id = 1
                db.flush()
        with pytest.raises(IntegrityError):
            with db.begin_nested():
                db.delete(db.get(Employee, 1))
                db.flush()
        assert db.get(PlatformUser, target).employee_id == 1


def test_audit_failure_rolls_back_mapping(workspace, monkeypatch):
    _, factory, admin, target, _ = workspace
    def fail(*args, **kwargs):
        raise RuntimeError('injected audit failure')
    monkeypatch.setattr(service, 'append_audit_event', fail)
    with factory() as db:
        actor = load_user_with_rbac(db, admin)
        with pytest.raises(RuntimeError, match='injected audit failure'):
            service.change_employee_link(db, target, 1, actor=actor, reason='Verified')
        db.commit()
    with factory() as db:
        assert db.get(PlatformUser, target).employee_id is None
        assert not audit_rows(db)


def test_production_ledger_task_and_historical_actor_rows_are_unchanged(scheduler):
    from app.models.rbac import Role, Permission
    from app.models.sales import Lead
    from app.models.sewing_work_ledger import SewingWorkLedgerEntry
    from app.models.work_tasks import WorkTask, WorkTaskMessage
    from app.models.technical_card import TechnicalCard, TechnicalCardStageResult
    from app.models.calendar_assignment import CalendarAssignment
    from app.models.calendar_allocation import CalendarAllocation
    from app.services.rbac import PERM_ADMIN_ROLES_ASSIGN
    factory, _ = scheduler
    run(factory)
    with factory() as db:
        actor = PlatformUser(id=1, login='actor', password_hash='unused', display_name='Actor',
            roles=[Role(code='linker', name='Linker', permissions=[Permission(code=PERM_ADMIN_ROLES_ASSIGN)])])
        target = PlatformUser(id=2, login='historical', password_hash='unchanged', display_name='Historical')
        db.add_all([actor, target, Organization(id=1, name='HR')])
        db.flush()
        db.add(Employee(id=1, full_name='Verified', organization_id=1))
        lead = Lead(contact_name='History', source='test')
        db.add(lead)
        db.flush()
        task = WorkTask(title='Keep actor', lead_id=lead.id, created_by_platform_user_id=2,
                        responsible_platform_user_id=2, executor_platform_user_id=2)
        db.add(task)
        db.flush()
        db.add(WorkTaskMessage(work_task_id=task.id, author_platform_user_id=2, body='History'))
        db.add(SewingWorkLedgerEntry(platform_user_id=2, technical_card_id=1, kind='piece',
                                    qty=1, status='reserved', unit_price=10, price_label='Snapshot'))
        historical = AuditEvent(actor_platform_user_id=2, actor_login='historical', action='old',
                                entity_type='test', entity_id='1')
        db.add(historical)
        card = db.get(TechnicalCard, 1)
        card.created_by_platform_user_id = card.responsible_platform_user_id = 2
        card.plan_locked = True
        card.stage_results[0].status = 'in_progress'
        db.commit()
        models = [TechnicalCard, TechnicalCardStageResult, CalendarAssignment, CalendarAllocation,
                  SewingWorkLedgerEntry, WorkTask, WorkTaskMessage]
        def dump():
            return {m.__tablename__: [tuple(getattr(r, c.name) for c in m.__table__.columns)
                for r in db.scalars(select(m).order_by(m.id))] for m in models}
        before = dump()
        old_audit = tuple(getattr(historical, c.name) for c in AuditEvent.__table__.columns)
        for unlink in [False, True]:
            service.change_employee_link(db, 2, 1, actor=actor, reason='Verified correction', unlink=unlink)
            db.commit()
            assert dump() == before
            db.refresh(historical)
            assert tuple(getattr(historical, c.name) for c in AuditEvent.__table__.columns) == old_audit
