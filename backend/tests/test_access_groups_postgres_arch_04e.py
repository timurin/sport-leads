"""Local PostgreSQL rollback preservation and serialized group/legacy writes."""
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier

from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import text, select
from sqlalchemy.orm import sessionmaker

from app.models.auth import PlatformUser
from app.models.rbac import Role
from app.models.audit import AuditEvent
from app.schemas.access_groups import GroupCreate, GroupChange, GroupApply
from app.services import access_groups as groups
from app.services import rbac
from app.services.rbac_guard import AccessConflictError
from tests.auth_test_helpers import ensure_user_with_role
from tests.test_employee_user_link_postgres_arch_04a import owned_database
from tests.test_scheduler_migration_pc_04_1 import migration


def test_upgrade_downgrade_preserve_old_and_custom_groups_and_all_grants():
    revision=migration('arch04e_20261021_access_group_version.py')
    with owned_database() as engine:
        factory=sessionmaker(bind=engine,expire_on_commit=False)
        with factory() as db:
            admin=ensure_user_with_role(db,login='owner',role_code='admin')
            member=ensure_user_with_role(db,login='member',role_code='shop_operator')
            actor=rbac.load_user_with_rbac(db,admin)
            groups.create_group(db,GroupCreate(code='custom',name='Custom',permissions=['audit.read'],reason='Verified'),actor=actor)
            rbac.assign_role(db,platform_user_id=member,role_code='custom',actor=actor)
            db.commit()
        with engine.begin() as connection:
            revision.op=Operations(MigrationContext.configure(connection))
            tables=['platform_users','permissions','platform_user_roles','role_permissions','employees','audit_events']
            before={t:connection.execute(text('SELECT * FROM '+t+' ORDER BY 1,2')).mappings().all() for t in tables}
            old_roles=connection.execute(text('SELECT id,code,name,is_system,created_at FROM roles ORDER BY id')).all()
            for _ in range(2):
                revision.downgrade()
                assert connection.execute(text('SELECT id,code,name,is_system,created_at FROM roles ORDER BY id')).all()==old_roles
                for t in tables:
                    assert connection.execute(text('SELECT * FROM '+t+' ORDER BY 1,2')).mappings().all()==before[t]
                # Old RBAC joins still see custom+system groups during downgrade.
                codes=connection.execute(text('SELECT r.code FROM roles r JOIN platform_user_roles u ON r.id=u.role_id WHERE u.platform_user_id=:uid'),{'uid':member}).scalars().all()
                assert set(codes)=={'shop_operator','custom'}
                revision.upgrade()
                assert set(connection.execute(text('SELECT version FROM roles')).scalars())=={1}
                for t in tables:
                    assert connection.execute(text('SELECT * FROM '+t+' ORDER BY 1,2')).mappings().all()==before[t]


def test_concurrent_group_apply_has_one_winner_and_one_audit():
    with owned_database() as engine:
        factory=sessionmaker(bind=engine,expire_on_commit=False)
        with factory() as db:
            admin=ensure_user_with_role(db,login='owner',role_code='admin')
            actor=rbac.load_user_with_rbac(db,admin)
            groups.create_group(db,GroupCreate(code='custom',name='Custom',permissions=[],reason='Verified'),actor=actor)
            db.commit()
            body=GroupChange(version=1,name='Updated',permissions=['audit.read'],reason='Verified')
            preview=groups.preview_group(db,'custom',body,actor=actor)
            command=GroupApply(**body.model_dump(),revision=preview.revision,preview_fingerprint=preview.preview_fingerprint)
        barrier=Barrier(2)
        def apply(_):
            with factory() as db:
                actor=rbac.load_user_with_rbac(db,admin)
                barrier.wait(timeout=15)
                try:
                    groups.apply_group(db,'custom',command,actor=actor)
                    db.commit()
                    return 'applied'
                except AccessConflictError:
                    db.rollback()
                    return 'conflict'
        with ThreadPoolExecutor(max_workers=2) as pool:
            assert sorted(pool.map(apply,[1,2]))==['applied','conflict']
        with factory() as db:
            assert db.scalar(select(Role).where(Role.code=='custom')).version==2
            assert len(list(db.scalars(select(AuditEvent).where(AuditEvent.action=='access_group.updated'))))==1


def test_concurrent_legacy_admin_revocation_cannot_remove_both_administrators():
    with owned_database() as engine:
        factory=sessionmaker(bind=engine,expire_on_commit=False)
        with factory() as db:
            first=ensure_user_with_role(db,login='first',role_code='admin')
            second=ensure_user_with_role(db,login='second',role_code='admin')
        barrier=Barrier(2)
        def revoke(pair):
            actor_id,target_id=pair
            with factory() as db:
                actor=rbac.load_user_with_rbac(db,actor_id)
                barrier.wait(timeout=15)
                try:
                    rbac.revoke_role(db,platform_user_id=target_id,role_code='admin',actor=actor)
                    return 'applied'
                except (AccessConflictError,rbac.RbacForbiddenError):
                    db.rollback()
                    return 'blocked'
        with ThreadPoolExecutor(max_workers=2) as pool:
            assert sorted(pool.map(revoke,[(first,second),(second,first)]))==['applied','blocked']
        with factory() as db:
            users=list(db.scalars(select(PlatformUser)))
            assert sum('admin' in rbac.role_codes_for_user(u) for u in users)==1


def test_legacy_response_refreshes_a_cached_shared_group_after_another_transaction():
    with owned_database() as engine:
        factory=sessionmaker(bind=engine,expire_on_commit=False)
        with factory() as db:
            admin=ensure_user_with_role(db,login='owner',role_code='admin')
            target=ensure_user_with_role(db,login='member',role_code='shop_operator')
            actor=rbac.load_user_with_rbac(db,admin)
            groups.create_group(db,GroupCreate(code='custom',name='Custom',permissions=['audit.read'],reason='Verified'),actor=actor)
            rbac.assign_role(db,platform_user_id=target,role_code='custom',actor=actor)
        with factory() as first:
            actor=rbac.load_user_with_rbac(first,admin)
            cached=rbac.load_user_with_rbac(first,target)
            assert 'audit.read' in rbac.permission_codes_for_user(cached)
            with factory() as second:
                second_actor=rbac.load_user_with_rbac(second,admin)
                body=GroupChange(version=1,name='Changed',permissions=['size_grids.write'],reason='Verified')
                preview=groups.preview_group(second,'custom',body,actor=second_actor)
                groups.apply_group(second,'custom',GroupApply(**body.model_dump(),revision=preview.revision,
                    preview_fingerprint=preview.preview_fingerprint),actor=second_actor)
                second.commit()
            updated=rbac.assign_role(first,platform_user_id=target,role_code='catalog_editor',actor=actor)
            assert set(rbac.permission_codes_for_user(updated))=={'shop.kanban.transition','size_grids.write'}
