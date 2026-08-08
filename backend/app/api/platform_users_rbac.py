"""Platform user role assignment API (ADR-024 / 17.1.2.3–17.1.2.5 / 21.2.2)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session, selectinload

from app.api.deps_auth import require_permission
from app.database.session import get_db
from app.models.auth import PlatformUser
from app.models.rbac import Role
from app.schemas.auth import (
    PlatformUserInviteRequest,
    PlatformUserInviteResponse,
    PlatformUserMeRead,
    PlatformUserProfileUpdateRequest,
    PlatformUserSetPasswordRequest,
)
from app.schemas.rbac import (
    PlatformUserListRead,
    RoleAssignRequest,
    RoleListRead,
    RoleRead,
)
from app.services import auth as auth_service
from app.services import rbac as rbac_service
from app.services.auth import to_me_read

router = APIRouter(tags=["Platform users / RBAC"])

_STATUS_FILTERS = frozenset({"all", "active", "inactive", "invited", "pending"})


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
    q: str | None = Query(default=None, max_length=200),
    status_filter: str = Query(
        default="all",
        alias="status",
        max_length=20,
        description="all | active | inactive | invited | pending",
    ),
) -> PlatformUserListRead:
    normalized_status = (status_filter or "all").strip().lower()
    if normalized_status not in _STATUS_FILTERS:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="status: ожидается all|active|inactive|invited|pending",
        )

    stmt = select(PlatformUser).options(
        selectinload(PlatformUser.roles).selectinload(Role.permissions),
    )

    needle = (q or "").strip()
    if needle:
        like = f"%{needle}%"
        clauses = [
            PlatformUser.login.ilike(like),
            PlatformUser.display_name.ilike(like),
            PlatformUser.email.ilike(like),
            PlatformUser.department.ilike(like),
            PlatformUser.phone.ilike(like),
        ]
        if needle.isdigit():
            clauses.append(PlatformUser.id == int(needle))
        stmt = stmt.where(or_(*clauses))

    if normalized_status == "active":
        stmt = stmt.where(
            PlatformUser.is_active.is_(True),
            PlatformUser.invite_status == auth_service.INVITE_STATUS_ACTIVE,
        )
    elif normalized_status == "inactive":
        stmt = stmt.where(PlatformUser.is_active.is_(False))
    elif normalized_status == "invited":
        stmt = stmt.where(
            PlatformUser.invite_status == auth_service.INVITE_STATUS_INVITED
        )
    elif normalized_status == "pending":
        stmt = stmt.where(
            PlatformUser.invite_status == auth_service.INVITE_STATUS_PENDING
        )

    rows = db.scalars(
        stmt.order_by(PlatformUser.login.asc()).offset(offset).limit(limit)
    ).all()
    return PlatformUserListRead(items=[to_me_read(user) for user in rows])


@router.post(
    "/platform-users/invite",
    response_model=PlatformUserInviteResponse,
    status_code=status.HTTP_201_CREATED,
    operation_id="invite_platform_user",
)
def invite_platform_user(
    payload: PlatformUserInviteRequest,
    db: Session = Depends(get_db),
    actor: PlatformUser = Depends(
        require_permission(rbac_service.PERM_ADMIN_ROLES_ASSIGN)
    ),
) -> PlatformUserInviteResponse:
    try:
        user, temporary_password = auth_service.invite_platform_user(
            db,
            login=payload.login,
            display_name=payload.display_name,
            email=payload.email,
            phone=payload.phone,
            department=payload.department,
            position=payload.position,
            language=payload.language or "ru",
            role_codes=payload.role_codes,
            temporary_password=payload.temporary_password,
            actor=actor,
        )
    except auth_service.AuthValidationError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(error),
        ) from error
    except rbac_service.RbacValidationError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(error),
        ) from error
    except rbac_service.RbacNotFoundError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(error),
        ) from error
    return PlatformUserInviteResponse(
        user=to_me_read(user),
        temporary_password=temporary_password,
    )


@router.post(
    "/platform-users/{platform_user_id}/set-password",
    status_code=status.HTTP_204_NO_CONTENT,
    operation_id="set_platform_user_password",
)
def set_platform_user_password(
    platform_user_id: int,
    payload: PlatformUserSetPasswordRequest,
    db: Session = Depends(get_db),
    _: PlatformUser = Depends(
        require_permission(rbac_service.PERM_ADMIN_ROLES_ASSIGN)
    ),
) -> Response:
    try:
        auth_service.set_platform_user_password(
            db,
            platform_user_id=platform_user_id,
            new_password=payload.new_password,
        )
    except auth_service.AuthValidationError as error:
        message = str(error)
        code = (
            status.HTTP_404_NOT_FOUND
            if "не найден" in message.lower()
            else status.HTTP_422_UNPROCESSABLE_ENTITY
        )
        raise HTTPException(status_code=code, detail=message) from error
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.patch(
    "/platform-users/{platform_user_id}",
    response_model=PlatformUserMeRead,
    operation_id="update_platform_user_profile",
)
def update_platform_user_profile(
    platform_user_id: int,
    payload: PlatformUserProfileUpdateRequest,
    db: Session = Depends(get_db),
    _: PlatformUser = Depends(
        require_permission(rbac_service.PERM_ADMIN_ROLES_ASSIGN)
    ),
) -> PlatformUserMeRead:
    fields = payload.model_dump(exclude_unset=True)
    if not fields:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Нет полей для обновления",
        )
    try:
        user = auth_service.update_platform_user_profile(
            db,
            platform_user_id=platform_user_id,
            fields=fields,
        )
    except auth_service.AuthValidationError as error:
        message = str(error)
        code = (
            status.HTTP_404_NOT_FOUND
            if "не найден" in message.lower()
            else status.HTTP_422_UNPROCESSABLE_ENTITY
        )
        raise HTTPException(status_code=code, detail=message) from error
    return to_me_read(user)


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
