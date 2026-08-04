"""Platform user role assignment API (ADR-024 / 17.1.2.3–17.1.2.5)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.api.deps_auth import require_permission
from app.database.session import get_db
from app.models.auth import PlatformUser
from app.models.rbac import Role
from app.schemas.auth import PlatformUserMeRead
from app.schemas.rbac import (
    PlatformUserListRead,
    RoleAssignRequest,
    RoleListRead,
    RoleRead,
)
from app.services import rbac as rbac_service
from app.services.auth import to_me_read

router = APIRouter(tags=["Platform users / RBAC"])


@router.get(
    "/platform-users",
    response_model=PlatformUserListRead,
    operation_id="list_platform_users",
)
def list_platform_users(
    db: Session = Depends(get_db),
    _: PlatformUser = Depends(
        require_permission(rbac_service.PERM_ADMIN_ROLES_ASSIGN)
    ),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
) -> PlatformUserListRead:
    rows = db.scalars(
        select(PlatformUser)
        .options(
            selectinload(PlatformUser.roles).selectinload(Role.permissions),
        )
        .order_by(PlatformUser.login.asc())
        .offset(offset)
        .limit(limit)
    ).all()
    return PlatformUserListRead(items=[to_me_read(user) for user in rows])


@router.get(
    "/roles",
    response_model=RoleListRead,
    operation_id="list_roles",
)
def list_roles(
    db: Session = Depends(get_db),
    _: PlatformUser = Depends(
        require_permission(rbac_service.PERM_ADMIN_ROLES_ASSIGN)
    ),
) -> RoleListRead:
    rbac_service.ensure_rbac_seed(db)
    rows = db.scalars(
        select(Role)
        .options(selectinload(Role.permissions))
        .order_by(Role.code)
    ).all()
    return RoleListRead(
        items=[
            RoleRead(
                id=role.id,
                code=role.code,
                name=role.name,
                is_system=role.is_system,
                permissions=sorted(p.code for p in (role.permissions or [])),
            )
            for role in rows
        ]
    )


@router.post(
    "/platform-users/{platform_user_id}/roles",
    response_model=PlatformUserMeRead,
    operation_id="assign_platform_user_role",
)
def assign_platform_user_role(
    platform_user_id: int,
    payload: RoleAssignRequest,
    db: Session = Depends(get_db),
    actor: PlatformUser = Depends(
        require_permission(rbac_service.PERM_ADMIN_ROLES_ASSIGN)
    ),
) -> PlatformUserMeRead:
    try:
        user = rbac_service.assign_role(
            db,
            platform_user_id=platform_user_id,
            role_code=payload.role_code,
            actor=actor,
        )
    except rbac_service.RbacNotFoundError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(error),
        ) from error
    except rbac_service.RbacValidationError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(error),
        ) from error
    return to_me_read(user)


@router.delete(
    "/platform-users/{platform_user_id}/roles/{role_code}",
    response_model=PlatformUserMeRead,
    operation_id="revoke_platform_user_role",
)
def revoke_platform_user_role(
    platform_user_id: int,
    role_code: str,
    db: Session = Depends(get_db),
    actor: PlatformUser = Depends(
        require_permission(rbac_service.PERM_ADMIN_ROLES_ASSIGN)
    ),
) -> PlatformUserMeRead:
    try:
        user = rbac_service.revoke_role(
            db,
            platform_user_id=platform_user_id,
            role_code=role_code,
            actor=actor,
        )
    except rbac_service.RbacNotFoundError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(error),
        ) from error
    except rbac_service.RbacValidationError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(error),
        ) from error
    return to_me_read(user)
