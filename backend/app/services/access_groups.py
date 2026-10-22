"""Role-backed access groups; pure previews and serialized audited mutations."""
import hashlib
import json
from collections import Counter

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.models.auth import PlatformUser
from app.models.rbac import Role, Permission, platform_user_roles
from app.schemas.rbac import RoleRead
from app.schemas.access_groups import (
    AccessPreview, EffectiveAccessRead, GroupCreate, GroupChange, GroupApply,
    GroupDelete, MembershipChange, MembershipApply,
)
from app.services import rbac
from app.services.audit import append_audit_event
from app.services.rbac_guard import AccessConflictError, lock_access, access_state, require_actor, validate_transition


def digest(value: object) -> str:
    return hashlib.sha256(json.dumps(value, sort_keys=True, ensure_ascii=False).encode()).hexdigest()


def snapshot(db: Session) -> dict:
    roles = list(db.scalars(select(Role).options(selectinload(Role.permissions))
                           .order_by(Role.code).execution_options(populate_existing=True)))
    members = list(db.execute(select(platform_user_roles.c.platform_user_id, platform_user_roles.c.role_id)
                              .order_by(platform_user_roles.c.platform_user_id, platform_user_roles.c.role_id)))
    state = access_state(db)
    revision = digest({
        'roles': [(r.id, r.code, r.name, r.is_system, r.version, sorted(p.code for p in r.permissions)) for r in roles],
        'members': [tuple(row) for row in members],
        'state': [(uid, active, invite, sorted(codes)) for uid, (active, invite, codes) in sorted(state.items())],
    })
    return {'roles': roles, 'members': members, 'state': state, 'revision': revision}


def role_read(role: Role, count: int = 0) -> RoleRead:
    return RoleRead(id=role.id, code=role.code, name=role.name, is_system=role.is_system,
                    version=role.version, member_count=count, permissions=sorted(p.code for p in role.permissions))


def list_groups(db: Session, *, actor: PlatformUser) -> list[RoleRead]:
    data = snapshot(db)
    require_actor(data['state'], actor.id)
    counts = Counter(rid for _, rid in data['members'])
    return [role_read(r, counts[r.id]) for r in data['roles']]


def get_group(data: dict, code: str) -> Role:
    role = next((r for r in data['roles'] if r.code == code), None)
    if role is None:
        raise rbac.RbacNotFoundError('Группа не найдена')
    return role


def permissions_for(db: Session, codes: list[str]) -> list[Permission]:
    if len(set(codes)) != len(codes):
        raise rbac.RbacValidationError('permission codes must be unique')
    rows = list(db.scalars(select(Permission).where(Permission.code.in_(codes)))) if codes else []
    if {r.code for r in rows} != set(codes):
        raise rbac.RbacValidationError('Неизвестный backend permission code')
    return rows


def create_group(db: Session, body: GroupCreate, *, actor: PlatformUser) -> RoleRead:
    lock_access(db)
    data = snapshot(db)
    require_actor(data['state'], actor.id)
    reserved = {code for code, _, _ in rbac.MVP_ROLES}
    if body.code in reserved or any(r.code == body.code for r in data['roles']):
        raise AccessConflictError('group_code_exists: код группы занят или системный')
    perms = permissions_for(db, body.permissions)
    try:
        with db.begin_nested():
            role = Role(code=body.code, name=body.name, is_system=False, permissions=perms)
            db.add(role)
            db.flush()
            append_audit_event(db, actor=actor, action='access_group.created', entity_type='role', entity_id=role.id,
                payload={'before': None, 'after': role_read(role).model_dump(), 'reason': body.reason})
    except IntegrityError as error:
        constraint = getattr(getattr(error.orig, 'diag', None), 'constraint_name', None)
        if constraint == 'uq_roles_code' or 'UNIQUE constraint failed: roles.code' in str(error.orig):
            raise AccessConflictError('group_code_exists: код группы занят') from error
        raise
    return role_read(role)


def proposed_state(data: dict, *, group: Role | None = None, permissions: list[str] | None = None,
                   user_id: int | None = None, role_codes: list[str] | None = None) -> dict:
    by_id = {r.id: {p.code for p in r.permissions} for r in data['roles']}
    if group is not None:
        by_id[group.id] = set(permissions)
    memberships = {}
    for uid, rid in data['members']:
        memberships.setdefault(uid, set()).add(rid)
    if user_id is not None:
        memberships[user_id] = {r.id for r in data['roles'] if r.code in role_codes}
    return {uid: (active, invite, set().union(*(by_id[rid] for rid in memberships.get(uid, set()))))
            for uid, (active, invite, _) in data['state'].items()}


def preview_result(data: dict, after: dict, actor_id: int, kind: str, target: str | int,
                   body: dict, affected: int, before_codes: set[str] | list[str],
                   after_codes: set[str] | list[str]) -> AccessPreview:
    blocker = None
    try:
        validate_transition(data['state'], after, actor_id)
    except AccessConflictError as error:
        blocker = str(error)
    return AccessPreview(revision=data['revision'],
        preview_fingerprint=digest([data['revision'], kind, target, actor_id, body]),
        can_apply=blocker is None, blocker=blocker, affected_count=affected,
        granted=sorted(set(after_codes)-set(before_codes)), removed=sorted(set(before_codes)-set(after_codes)))


def change_data(body: GroupChange | MembershipChange) -> dict:
    return body.model_dump(exclude={'revision', 'preview_fingerprint'})


def preview_group(db: Session, code: str, body: GroupChange, *, actor: PlatformUser) -> AccessPreview:
    data = snapshot(db)
    require_actor(data['state'], actor.id)
    group = get_group(data, code)
    if group.is_system or group.code in {code for code, _, _ in rbac.MVP_ROLES}:
        raise AccessConflictError('system_group_read_only: системные группы неизменяемы')
    if group.version != body.version:
        raise AccessConflictError('access_changed: версия группы изменилась')
    permissions_for(db, body.permissions)
    after = proposed_state(data, group=group, permissions=body.permissions)
    members = {uid for uid, rid in data['members'] if rid == group.id}
    result = preview_result(data, after, actor.id, 'group', code, change_data(body),
        len(members), {p.code for p in group.permissions}, body.permissions)
    # Report real effective deltas, including overlapping grants from other groups.
    return result.model_copy(update={
        'group_granted': result.granted, 'group_removed': result.removed,
        'granted': sorted(set().union(*(after[uid][2]-data['state'][uid][2] for uid in members))),
        'removed': sorted(set().union(*(data['state'][uid][2]-after[uid][2] for uid in members))),
    })


def check_preview(preview: AccessPreview, body: GroupApply | MembershipApply) -> None:
    if preview.revision != body.revision or preview.preview_fingerprint != body.preview_fingerprint:
        raise AccessConflictError('access_changed: обновите данные и повторите предпросмотр')
    if not preview.can_apply:
        raise AccessConflictError(preview.blocker)


def apply_group(db: Session, code: str, body: GroupApply, *, actor: PlatformUser) -> RoleRead:
    lock_access(db)
    preview = preview_group(db, code, body, actor=actor)
    check_preview(preview, body)
    group = get_group(snapshot(db), code)
    before = role_read(group, preview.affected_count)
    if group.name == body.name and set(body.permissions) == {p.code for p in group.permissions}:
        return before
    with db.begin_nested():
        group.name = body.name
        group.permissions = permissions_for(db, body.permissions)
        group.version += 1
        db.flush()
        append_audit_event(db, actor=actor, action='access_group.updated', entity_type='role', entity_id=group.id,
            payload={'before': before.model_dump(), 'after': role_read(group, preview.affected_count).model_dump(),
                     'reason': body.reason, 'affected_count': preview.affected_count,
                     'granted': preview.granted, 'removed': preview.removed,
                     'group_granted': preview.group_granted, 'group_removed': preview.group_removed})
    return role_read(group, preview.affected_count)


def delete_group(db: Session, code: str, body: GroupDelete, *, actor: PlatformUser) -> None:
    lock_access(db)
    data = snapshot(db)
    require_actor(data['state'], actor.id)
    group = get_group(data, code)
    if group.is_system or group.code in {code for code, _, _ in rbac.MVP_ROLES}:
        raise AccessConflictError('system_group_read_only: системные группы неизменяемы')
    if group.version != body.version:
        raise AccessConflictError('access_changed: версия группы изменилась')
    if any(rid == group.id for _, rid in data['members']):
        raise AccessConflictError('group_has_members: сначала явно снимите назначения')
    with db.begin_nested():
        before = role_read(group).model_dump()
        db.delete(group)
        db.flush()
        append_audit_event(db, actor=actor, action='access_group.deleted', entity_type='role', entity_id=before['id'],
                           payload={'before': before, 'after': None, 'reason': body.reason})


def effective_access(db: Session, user_id: int, *, actor: PlatformUser) -> EffectiveAccessRead:
    data = snapshot(db)
    require_actor(data['state'], actor.id)
    if user_id not in data['state']:
        raise rbac.RbacNotFoundError('Пользователь не найден')
    ids = {rid for uid, rid in data['members'] if uid == user_id}
    codes = data['state'][user_id][2]
    return EffectiveAccessRead(platform_user_id=user_id,
        role_codes=sorted(r.code for r in data['roles'] if r.id in ids), permissions=sorted(codes),
        restricted='sewing_cabinet.read_own' in codes and 'sewing_cabinet.read_any' not in codes,
        revision=data['revision'])


def preview_membership(db: Session, user_id: int, body: MembershipChange, *, actor: PlatformUser) -> AccessPreview:
    data = snapshot(db)
    require_actor(data['state'], actor.id)
    if user_id not in data['state']:
        raise rbac.RbacNotFoundError('Пользователь не найден')
    if len(set(body.role_codes)) != len(body.role_codes):
        raise rbac.RbacValidationError('role codes must be unique')
    for code in body.role_codes:
        get_group(data, code)
    after = proposed_state(data, user_id=user_id, role_codes=body.role_codes)
    return preview_result(data, after, actor.id, 'membership', user_id, change_data(body), 1,
                          data['state'][user_id][2], after[user_id][2])


def apply_membership(db: Session, user_id: int, body: MembershipApply, *, actor: PlatformUser) -> EffectiveAccessRead:
    lock_access(db)
    preview = preview_membership(db, user_id, body, actor=actor)
    check_preview(preview, body)
    data = snapshot(db)
    wanted = [r for r in data['roles'] if r.code in body.role_codes]
    user = db.get(PlatformUser, user_id)
    db.expire(user, ['roles'])
    before_codes = sorted(r.code for r in user.roles)
    if before_codes != sorted(body.role_codes):
        with db.begin_nested():
            user.roles = wanted
            db.flush()
            append_audit_event(db, actor=actor, action='access_group.membership_updated',
                entity_type='platform_user', entity_id=user_id,
                payload={'before': {'role_codes': before_codes}, 'after': {'role_codes': sorted(body.role_codes)},
                         'reason': body.reason, 'granted': preview.granted, 'removed': preview.removed})
    return effective_access(db, user_id, actor=actor)
