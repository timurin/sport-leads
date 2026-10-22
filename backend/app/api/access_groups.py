"""Role-backed group administration (ARCH-04E); old assignment APIs remain."""
from collections.abc import Callable
from typing import TypeVar
from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps_auth import require_permission
from app.database.session import get_db
from app.models.auth import PlatformUser
from app.models.rbac import Permission
from app.schemas.access_groups import (
    GroupCreate, GroupChange, GroupApply, GroupDelete, MembershipChange, MembershipApply,
    PermissionRead, AccessPreview, EffectiveAccessRead,
)
from app.schemas.rbac import RoleRead
from app.services import access_groups as service
from app.services import rbac
from app.services.rbac_guard import AccessConflictError

router = APIRouter(tags=['Access groups'])
admin = require_permission(rbac.PERM_ADMIN_ROLES_ASSIGN)
T = TypeVar('T')


def execute(db: Session, callback: Callable[[], T], *, commit: bool = False) -> T:
    try:
        result = callback()
        if commit:
            db.commit()
        return result
    except (AccessConflictError, rbac.RbacNotFoundError, rbac.RbacValidationError, rbac.RbacForbiddenError) as error:
        db.rollback()
        code = 409 if isinstance(error, AccessConflictError) else 404 if isinstance(error, rbac.RbacNotFoundError) else 403 if isinstance(error, rbac.RbacForbiddenError) else 422
        raise HTTPException(status_code=code, detail=str(error)) from error


@router.get('/permissions', response_model=list[PermissionRead], operation_id='list_access_permissions')
def permissions(db: Session = Depends(get_db), actor: PlatformUser = Depends(admin)) -> list[PermissionRead]:
    def read() -> list[PermissionRead]:
        service.list_groups(db, actor=actor)  # Recheck the current server authority.
        return [PermissionRead(code=p.code, description=p.description)
                for p in db.scalars(select(Permission).order_by(Permission.code))]
    return execute(db, read)


@router.post('/roles', response_model=RoleRead, status_code=201, operation_id='create_access_group')
def create_group(body: GroupCreate, db: Session = Depends(get_db), actor: PlatformUser = Depends(admin)) -> RoleRead:
    return execute(db, lambda: service.create_group(db, body, actor=actor), commit=True)


@router.get('/roles/{code}', response_model=RoleRead, operation_id='read_access_group')
def read_group(code: str, db: Session = Depends(get_db), actor: PlatformUser = Depends(admin)) -> RoleRead:
    def read() -> RoleRead:
        groups = service.list_groups(db, actor=actor)
        group = next((r for r in groups if r.code == code), None)
        if group is None:
            raise rbac.RbacNotFoundError('Группа не найдена')
        return group
    return execute(db, read)


@router.post('/roles/{code}/preview', response_model=AccessPreview, operation_id='preview_access_group')
def preview_group(code: str, body: GroupChange, db: Session = Depends(get_db), actor: PlatformUser = Depends(admin)) -> AccessPreview:
    return execute(db, lambda: service.preview_group(db, code, body, actor=actor))


@router.patch('/roles/{code}', response_model=RoleRead, operation_id='update_access_group')
def update_group(code: str, body: GroupApply, db: Session = Depends(get_db), actor: PlatformUser = Depends(admin)) -> RoleRead:
    return execute(db, lambda: service.apply_group(db, code, body, actor=actor), commit=True)


@router.delete('/roles/{code}', status_code=204, operation_id='delete_access_group')
def delete_group(code: str, body: GroupDelete, db: Session = Depends(get_db), actor: PlatformUser = Depends(admin)) -> Response:
    execute(db, lambda: service.delete_group(db, code, body, actor=actor), commit=True)
    return Response(status_code=204)


@router.get('/platform-users/{platform_user_id}/roles', response_model=EffectiveAccessRead,
            operation_id='read_access_group_membership')
def membership(platform_user_id: int, db: Session = Depends(get_db), actor: PlatformUser = Depends(admin)) -> EffectiveAccessRead:
    return execute(db, lambda: service.effective_access(db, platform_user_id, actor=actor))


@router.get('/platform-users/{platform_user_id}/effective-permissions', response_model=EffectiveAccessRead,
            operation_id='read_effective_access_permissions')
def effective(platform_user_id: int, db: Session = Depends(get_db), actor: PlatformUser = Depends(admin)) -> EffectiveAccessRead:
    return execute(db, lambda: service.effective_access(db, platform_user_id, actor=actor))


@router.post('/platform-users/{platform_user_id}/roles/preview', response_model=AccessPreview,
             operation_id='preview_access_group_membership')
def preview_membership(platform_user_id: int, body: MembershipChange, db: Session = Depends(get_db), actor: PlatformUser = Depends(admin)) -> AccessPreview:
    return execute(db, lambda: service.preview_membership(db, platform_user_id, body, actor=actor))


@router.put('/platform-users/{platform_user_id}/roles', response_model=EffectiveAccessRead,
            operation_id='replace_access_group_membership')
def update_membership(platform_user_id: int, body: MembershipApply, db: Session = Depends(get_db), actor: PlatformUser = Depends(admin)) -> EffectiveAccessRead:
    return execute(db, lambda: service.apply_membership(db, platform_user_id, body, actor=actor), commit=True)
