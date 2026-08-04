"""Stage executors HTTP API (17.1.2.8)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps_auth import get_current_platform_user, require_permission
from app.database.session import get_db
from app.models.auth import PlatformUser
from app.schemas.stage_executors import (
    StageExecutorListRead,
    StageExecutorReplaceRequest,
)
from app.services import rbac as rbac_service
from app.services.stage_executors import (
    StageExecutorNotFoundError,
    list_stage_executors,
    set_stage_executors,
)

router = APIRouter(tags=["Stage executors"])


@router.get(
    "/shop-stage-executors",
    response_model=StageExecutorListRead,
    operation_id="list_shop_stage_executors",
)
def list_shop_stage_executors(
    stage_code: str = Query(min_length=1, max_length=64),
    db: Session = Depends(get_db),
    _: PlatformUser = Depends(get_current_platform_user),
) -> StageExecutorListRead:
    try:
        return list_stage_executors(db, stage_code=stage_code)
    except StageExecutorNotFoundError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(error),
        ) from error


@router.get(
    "/production-stages/{stage_id}/executors",
    response_model=StageExecutorListRead,
    operation_id="list_production_stage_executors",
)
def list_production_stage_executors(
    stage_id: int,
    db: Session = Depends(get_db),
    _: PlatformUser = Depends(get_current_platform_user),
) -> StageExecutorListRead:
    try:
        return list_stage_executors(db, production_stage_id=stage_id)
    except StageExecutorNotFoundError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(error),
        ) from error


@router.put(
    "/production-stages/{stage_id}/executors",
    response_model=StageExecutorListRead,
    operation_id="replace_production_stage_executors",
)
def replace_production_stage_executors(
    stage_id: int,
    payload: StageExecutorReplaceRequest,
    db: Session = Depends(get_db),
    actor: PlatformUser = Depends(
        require_permission(rbac_service.PERM_ADMIN_ROLES_ASSIGN)
    ),
) -> StageExecutorListRead:
    try:
        return set_stage_executors(
            db,
            production_stage_id=stage_id,
            platform_user_ids=payload.platform_user_ids,
            actor=actor,
        )
    except StageExecutorNotFoundError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(error),
        ) from error
