"""Platform directories HTTP API (18.2.2)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps_auth import get_current_platform_user, require_permission
from app.database.session import get_db
from app.models.auth import PlatformUser
from app.schemas.platform_directories import (
    PlatformCityCreate,
    PlatformCityRead,
    PlatformCityUpdate,
    PlatformDirectoryRegistryItem,
)
from app.services import rbac as rbac_service
from app.services.platform_directories import (
    PlatformCityConflictError,
    PlatformCityNotFoundError,
    PlatformCityValidationError,
    create_platform_city,
    delete_platform_city,
    get_platform_city,
    list_platform_cities,
    list_platform_directory_registry,
    update_platform_city,
)

router = APIRouter(prefix="/platform-directories", tags=["Platform directories"])


@router.get(
    "",
    response_model=list[PlatformDirectoryRegistryItem],
    operation_id="list_platform_directory_registry",
)
def read_platform_directory_registry(
    _: PlatformUser = Depends(get_current_platform_user),
) -> list[PlatformDirectoryRegistryItem]:
    return list_platform_directory_registry()


@router.get(
    "/cities",
    response_model=list[PlatformCityRead],
    operation_id="list_platform_cities",
)
def read_platform_cities(
    is_active: bool | None = Query(default=None),
    q: str | None = Query(default=None),
    limit: int = Query(default=200, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    _: PlatformUser = Depends(get_current_platform_user),
) -> list[PlatformCityRead]:
    return list_platform_cities(
        db, is_active=is_active, q=q, limit=limit, offset=offset
    )


@router.post(
    "/cities",
    response_model=PlatformCityRead,
    status_code=status.HTTP_201_CREATED,
    operation_id="create_platform_city",
)
def create_platform_city_endpoint(
    payload: PlatformCityCreate,
    db: Session = Depends(get_db),
    _: PlatformUser = Depends(
        require_permission(rbac_service.PERM_PLATFORM_DIRECTORIES_WRITE)
    ),
) -> PlatformCityRead:
    try:
        return create_platform_city(db, payload)
    except PlatformCityConflictError as error:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail=str(error)
        ) from error
    except PlatformCityValidationError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(error)
        ) from error


@router.get(
    "/cities/{city_id}",
    response_model=PlatformCityRead,
    operation_id="get_platform_city",
)
def read_platform_city(
    city_id: int,
    db: Session = Depends(get_db),
    _: PlatformUser = Depends(get_current_platform_user),
) -> PlatformCityRead:
    try:
        return get_platform_city(db, city_id)
    except PlatformCityNotFoundError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=str(error)
        ) from error


@router.patch(
    "/cities/{city_id}",
    response_model=PlatformCityRead,
    operation_id="update_platform_city",
)
def patch_platform_city(
    city_id: int,
    payload: PlatformCityUpdate,
    db: Session = Depends(get_db),
    _: PlatformUser = Depends(
        require_permission(rbac_service.PERM_PLATFORM_DIRECTORIES_WRITE)
    ),
) -> PlatformCityRead:
    try:
        return update_platform_city(db, city_id, payload)
    except PlatformCityNotFoundError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=str(error)
        ) from error
    except PlatformCityConflictError as error:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail=str(error)
        ) from error
    except PlatformCityValidationError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(error)
        ) from error


@router.delete(
    "/cities/{city_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    operation_id="delete_platform_city",
)
def remove_platform_city(
    city_id: int,
    db: Session = Depends(get_db),
    _: PlatformUser = Depends(
        require_permission(rbac_service.PERM_PLATFORM_DIRECTORIES_WRITE)
    ),
) -> None:
    try:
        delete_platform_city(db, city_id)
    except PlatformCityNotFoundError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=str(error)
        ) from error
