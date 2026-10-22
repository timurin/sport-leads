"""Role-backed groups, compatibility, real catalog and guarded administration."""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import event, select

from app.main import app
from app.models.auth import PlatformUser
from app.models.rbac import Permission, Role
from app.models.audit import AuditEvent
from app.schemas.access_groups import GroupChange
from app.services import access_groups as service
from app.services import rbac
from tests.test_employee_user_link_arch_04a import workspace
from tests.auth_test_helpers import login_client


def create(api, code='custom', permissions=None):
    response = api.post('/roles', json={'code': code, 'name': code.title(),
        'permissions': permissions or ['size_grids.write'], 'reason': 'Approved group'})
    assert response.status_code == 201, response.text
    return response.json()


def replace(api, user, codes):
    body = {'role_codes': codes, 'reason': 'Approved membership'}
    preview = api.post(f'/platform-users/{user}/roles/preview', json=body)
    assert preview.status_code == 200, preview.text
    token = preview.json()
    return api.put(f'/platform-users/{user}/roles', json={**body,
        'revision': token['revision'], 'preview_fingerprint': token['preview_fingerprint']})


def change(api, code, body):
    preview = api.post(f'/roles/{code}/preview', json=body)
    assert preview.status_code == 200, preview.text
    token = preview.json()
    return api.patch(f'/roles/{code}', json={**body, 'revision': token['revision'],
                                           'preview_fingerprint': token['preview_fingerprint']})


def test_full_catalog_union_and_old_client_compatibility(workspace):
    api, factory, _, target, _ = workspace
    with factory() as db:
        db.add(Permission(code='test.unassigned', description='Real unassigned database code'))
        db.commit()
    permissions = api.get('/permissions')
    assert permissions.status_code == 200
    assert 'test.unassigned' in {r['code'] for r in permissions.json()}
    create(api, 'one')
    create(api, 'two', ['audit.read'])
    result = replace(api, target, ['shop_operator', 'one', 'two'])
    assert result.status_code == 200, result.text
    assert set(result.json()['permissions']) == {'shop.kanban.transition','size_grids.write','audit.read'}
    assert api.get(f'/platform-users/{target}/effective-permissions').json() == result.json()
    assert api.get(f'/platform-users/{target}/roles').json() == result.json()
    with TestClient(app) as user:
        login_client(user, login='target04a')
        assert set(user.get('/auth/me').json()['permissions']) == set(result.json()['permissions'])
    # A legacy POST is idempotent and cannot overwrite other memberships.
    for _ in range(2):
        legacy = api.post(f'/platform-users/{target}/roles', json={'role_code': 'one'})
        assert legacy.status_code == 200, legacy.text
        assert set(legacy.json()['roles']) == {'shop_operator','one','two'}
        assert 'revision' not in legacy.json()
    removed = api.delete(f'/platform-users/{target}/roles/one')
    assert removed.status_code == 200
    assert set(removed.json()['roles']) == {'shop_operator','two'}
    with factory() as db:
        rbac.ensure_rbac_seed(db)
        db.commit()
        assert {p.code for p in db.scalar(select(Role).where(Role.code=='two')).permissions} == {'audit.read'}


def test_group_crud_shared_preview_and_version(workspace):
    api, factory, _, target, other = workspace
    group = create(api)
    assert not group['is_system'] and group['version']==1 and group['member_count']==0
    for user in [target, other]:
        assert replace(api,user,['custom']).status_code==200
    body = {'version':1,'name':'Renamed','permissions':['audit.read'],'reason':'Owner approved shared change'}
    preview = api.post('/roles/custom/preview',json=body).json()
    assert preview['affected_count']==2 and preview['can_apply']
    assert preview['granted']==['audit.read'] and preview['removed']==['size_grids.write']
    response = change(api,'custom',body)
    assert response.status_code==200, response.text
    assert response.json()['version']==2 and response.json()['member_count']==2
    for user in [target,other]:
        assert api.get(f'/platform-users/{user}/effective-permissions').json()['permissions']==['audit.read']
    blocked=api.request('DELETE','/roles/custom',json={'version':2,'reason':'Delete'})
    assert blocked.status_code==409
    for user in [target,other]:
        assert replace(api,user,[]).status_code==200
    assert api.request('DELETE','/roles/custom',json={'version':1,'reason':'Stale delete'}).status_code==409
    assert api.request('DELETE','/roles/custom',json={'version':2,'reason':'Unused group'}).status_code==204
    assert api.get('/roles/custom').status_code==404
    with factory() as db:
        events=list(db.scalars(select(AuditEvent).where(AuditEvent.action.like('access_group.%'))))
        updated=next(r for r in events if r.action=='access_group.updated')
        assert updated.payload['affected_count']==2 and updated.payload['after']['permissions']==['audit.read']
        assert updated.actor_login=='admin04a' and updated.payload['reason']==body['reason']


def test_stale_preview_and_changed_body_are_conflicts(workspace):
    api, _, _, target, other=workspace
    create(api)
    body={'version':1,'name':'New','permissions':['audit.read'],'reason':'Verified'}
    preview=api.post('/roles/custom/preview',json=body).json()
    assert replace(api,other,['custom']).status_code==200
    apply={**body,'revision':preview['revision'],'preview_fingerprint':preview['preview_fingerprint']}
    assert api.patch('/roles/custom',json=apply).status_code==409
    member={'role_codes':['custom'],'reason':'Verified'}
    p=api.post(f'/platform-users/{target}/roles/preview',json=member).json()
    altered={**member,'role_codes':[], 'revision':p['revision'],'preview_fingerprint':p['preview_fingerprint']}
    assert api.put(f'/platform-users/{target}/roles',json=altered).status_code==409


def test_preview_effective_delta_respects_overlapping_groups(workspace):
    api,_,_,target,_=workspace
    create(api,'one',['audit.read'])
    create(api,'two',['audit.read'])
    assert replace(api,target,['one','two']).status_code==200
    body={'version':1,'name':'One','permissions':[],'reason':'Remove duplicate grant'}
    preview=api.post('/roles/one/preview',json=body).json()
    assert preview['removed']==[] and preview['group_removed']==['audit.read']
    assert change(api,'one',body).status_code==200
    assert api.get(f'/platform-users/{target}/effective-permissions').json()['permissions']==['audit.read']


def test_system_groups_and_invalid_catalog_requests(workspace):
    api, _, _, target, _=workspace
    create(api)
    assert api.post('/roles',json={'code':'custom','name':'Duplicate','permissions':[],'reason':'Test'}).status_code==409
    for codes in [['made.up'],['audit.read','audit.read']]:
        assert api.post('/roles',json={'code':'invalid','name':'Invalid','permissions':codes,'reason':'Test'}).status_code==422
    assert api.post('/roles/admin/preview',json={'version':1,'name':'New','permissions':[],'reason':'Test'}).status_code==409
    assert api.request('DELETE','/roles/admin',json={'version':1,'reason':'Test'}).status_code==409
    assert api.get('/roles/does_not_exist').status_code==404
    assert api.get('/platform-users/999999/effective-permissions').status_code==404
    assert api.post(f'/platform-users/{target}/roles/preview',json={'role_codes':['missing'],'reason':'Test'}).status_code==404
    assert api.post(f'/platform-users/{target}/roles/preview',json={'role_codes':['custom','custom'],'reason':'Test'}).status_code==422


def test_last_admin_and_self_lockout_all_paths(workspace):
    api, _, admin, target, _=workspace
    assert api.delete(f'/platform-users/{admin}/roles/admin').status_code==409
    assert api.patch(f'/platform-users/{admin}',json={'is_active':False}).status_code==409
    assert replace(api,admin,[]).status_code==409
    assert api.post(f'/platform-users/{target}/roles',json={'role_code':'admin'}).status_code==200
    # Still protect the operator from self-lockout even with another admin.
    assert replace(api,admin,[]).status_code==409
    assert api.delete(f'/platform-users/{target}/roles/admin').status_code==200
    assert 'admin' in api.get('/auth/me').json()['roles']


def test_custom_manager_group_and_restricted_mode_protection(workspace):
    api, factory, admin, target, _=workspace
    create(api,'managers',['admin.roles.assign'])
    assert replace(api,target,['managers']).status_code==200
    with TestClient(app) as manager:
        login_client(manager,login='target04a')
        assert manager.get('/permissions').status_code==200
        body={'version':1,'name':'Managers','permissions':[],'reason':'Remove self access'}
        assert change(manager,'managers',body).status_code==409
        # Effective permission alone is insufficient if the new mode is restricted.
        restricted={**body,'permissions':['admin.roles.assign','sewing_cabinet.read_own']}
        assert change(manager,'managers',restricted).status_code==409
    with factory() as db:
        assert db.get(PlatformUser,admin).is_active


@pytest.mark.parametrize('method,path,body',[
    ('GET','/roles',None),('GET','/permissions',None),('GET','/roles/admin',None),
    ('POST','/roles',{'code':'new','name':'New','permissions':[],'reason':'Test'}),
    ('POST','/roles/admin/preview',{'version':1,'name':'New','permissions':[],'reason':'Test'}),
    ('DELETE','/roles/admin',{'version':1,'reason':'Test'}),
])
def test_read_and_write_authorization(workspace,method,path,body):
    _, _, _, _, _=workspace
    with TestClient(app) as api:
        assert api.request(method,path,json=body).status_code==401
        login_client(api,login='target04a')
        assert api.request(method,path,json=body).status_code==403


def test_preview_and_catalog_are_read_only_and_audit_failure_rolls_back(workspace,monkeypatch):
    api,factory,admin,_,_=workspace
    create(api)
    body=GroupChange(version=1,name='New',permissions=['audit.read'],reason='Verified')
    with factory() as db:
        actor=rbac.load_user_with_rbac(db,admin)
        engine=db.get_bind()
        writes=[]
        def observe(conn,cursor,sql,*args):
            if sql.lstrip().upper().startswith(('INSERT','UPDATE','DELETE')):
                writes.append(sql)
        event.listen(engine,'before_cursor_execute',observe)
        try:
            p=service.preview_group(db,'custom',body,actor=actor)
            service.list_groups(db,actor=actor)
            assert writes==[]
        finally:
            event.remove(engine,'before_cursor_execute',observe)
    from app.schemas.access_groups import GroupApply
    command=GroupApply(**body.model_dump(),revision=p.revision,preview_fingerprint=p.preview_fingerprint)
    def fail(*args,**kwargs):
        raise RuntimeError('audit unavailable')
    monkeypatch.setattr(service,'append_audit_event',fail)
    with factory() as db:
        actor=rbac.load_user_with_rbac(db,admin)
        with pytest.raises(RuntimeError,match='audit unavailable'):
            service.apply_group(db,'custom',command,actor=actor)
        db.commit()
    assert api.get('/roles/custom').json()['version']==1


def test_catalog_query_budget_is_bounded(workspace):
    api,factory,admin,_,_=workspace
    with factory() as db:
        actor=rbac.load_user_with_rbac(db,admin)
        engine=db.get_bind()
        counts=[]
        for count in [1,20]:
            db.add_all([Role(code=f'group_{count}_{i}',name='Custom',is_system=False) for i in range(count)])
            db.commit()
            sql=[]
            def observe(conn,cursor,statement,*args):
                sql.append(statement)
            event.listen(engine,'before_cursor_execute',observe)
            try:
                result=service.list_groups(db,actor=actor)
                assert all(r.member_count>=0 for r in result)
            finally:
                event.remove(engine,'before_cursor_execute',observe)
            counts.append(len(sql))
        assert counts[0]==counts[1]


def test_group_changes_preserve_employee_profile_and_production_history(workspace):
    from datetime import date
    from app.models.technical_card import TechnicalCard, TechnicalCardOrderGroup
    from app.models.sewing_work_ledger import SewingWorkLedgerEntry
    api,factory,_,target,_=workspace
    with factory() as db:
        user=db.get(PlatformUser,target)
        user.employee_id=1
        group=TechnicalCardOrderGroup(order_number='HISTORY',tech_cards_planned_count=1,desired_date=date(2026,12,1))
        db.add(group)
        db.flush()
        card=TechnicalCard(number='HISTORY-1',order_group_id=group.id,card_seq=1,quantity=1,
                           created_by_platform_user_id=target,responsible_platform_user_id=target)
        db.add(card)
        db.flush()
        ledger=SewingWorkLedgerEntry(platform_user_id=target,technical_card_id=card.id,kind='piece',
                                    qty=1,status='reserved',unit_price=12,price_label='Frozen')
        historical=AuditEvent(actor_platform_user_id=target,actor_login='target04a',action='historical',entity_type='test',entity_id='1')
        db.add_all([ledger,historical])
        db.commit()
        def columns(row):
            return tuple(getattr(row,c.name) for c in row.__table__.columns)
        ids=(card.id,ledger.id,historical.id)
        before=[columns(row) for row in [user,card,ledger,historical]]
    create(api)
    assert replace(api,target,['custom','shop_operator']).status_code==200
    assert change(api,'custom',{'version':1,'name':'Updated','permissions':['audit.read'],'reason':'Approved'}).status_code==200
    assert replace(api,target,['shop_operator']).status_code==200
    assert api.request('DELETE','/roles/custom',json={'version':2,'reason':'Unused'}).status_code==204
    with factory() as db:
        after=[columns(row) for row in [db.get(PlatformUser,target),db.get(TechnicalCard,ids[0]),
            db.get(SewingWorkLedgerEntry,ids[1]),db.get(AuditEvent,ids[2])]]
        assert after==before
