from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps_auth import require_permission
from app.database.session import get_db
from app.models.auth import PlatformUser
from app.models.size_grid import SizeGridSizeType
from app.schemas.size_grid import (
    SizeGridCreate,
    SizeGridListItem,
    SizeGridRead,
    SizeGridRowUpdate,
    SizeGridRowWrite,
    SizeGridUpdate,
)
from app.services import rbac as rbac_service
from app.services.size_grids import (
    SizeGridConflictError,
    SizeGridNotFoundError,
    SizeGridValidationError,
    create_size_grid,
    create_size_grid_row,
    delete_size_grid,
    delete_size_grid_row,
    get_size_grid,
    list_size_grids,
    update_size_grid,
    update_size_grid_row,
)

router = APIRouter(prefix="/size-grids", tags=["Size grids"])


def _http_error(error: Exception) -> HTTPException:
    if isinstance(error, SizeGridNotFoundError):
        return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error))
    if isinstance(error, SizeGridConflictError):
        return HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error))
    if isinstance(error, SizeGridValidationError):
        return HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(error),
        )
    return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error))


@router.get(
    "",
    response_model=list[SizeGridListItem],
    operation_id="list_size_grids",
)
def read_size_grids(
    size_type: SizeGridSizeType | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> list[SizeGridListItem]:
    return list_size_grids(db, size_type=size_type, limit=limit, offset=offset)


@router.post(
    "",
    response_model=SizeGridRead,
    status_code=status.HTTP_201_CREATED,
    operation_id="create_size_grid",
)
def create_size_grid_endpoint(
    payload: SizeGridCreate,
    db: Session = Depends(get_db),
    actor: PlatformUser = Depends(
        require_permission(rbac_service.PERM_SIZE_GRIDS_WRITE)
    ),
) -> SizeGridRead:
    try:
        return create_size_grid(db, payload, actor=actor)
    except (SizeGridConflictError, SizeGridValidationError) as error:
        raise _http_error(error) from error


@router.get(
    "/{grid_id}",
    response_model=SizeGridRead,
    operation_id="get_size_grid",
)
def read_size_grid(
    grid_id: int,
    db: Session = Depends(get_db),
) -> SizeGridRead:
    try:
        return get_size_grid(db, grid_id)
    except SizeGridNotFoundError as error:
        raise _http_error(error) from error


@router.patch(
    "/{grid_id}",
    response_model=SizeGridRead,
    operation_id="update_size_grid",
)
def patch_size_grid(
    grid_id: int,
    payload: SizeGridUpdate,
    db: Session = Depends(get_db),
    actor: PlatformUser = Depends(
        require_permission(rbac_service.PERM_SIZE_GRIDS_WRITE)
    ),
) -> SizeGridRead:
    try:
        return update_size_grid(db, grid_id, payload, actor=actor)
    except (
        SizeGridNotFoundError,
        SizeGridConflictError,
        SizeGridValidationError,
    ) as error:
        raise _http_error(error) from error


@router.delete(
    "/{grid_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    operation_id="delete_size_grid",
)
def remove_size_grid(
    grid_id: int,
    db: Session = Depends(get_db),
    actor: PlatformUser = Depends(
        require_permission(rbac_service.PERM_SIZE_GRIDS_WRITE)
    ),
) -> None:
    try:
        delete_size_grid(db, grid_id, actor=actor)
    except (SizeGridNotFoundError, SizeGridConflictError) as error:
        raise _http_error(error) from error


@router.post(
    "/{grid_id}/rows",
    response_model=SizeGridRead,
    status_code=status.HTTP_201_CREATED,
    operation_id="create_size_grid_row",
)
def create_row_endpoint(
    grid_id: int,
    payload: SizeGridRowWrite,
    db: Session = Depends(get_db),
    actor: PlatformUser = Depends(
        require_permission(rbac_service.PERM_SIZE_GRIDS_WRITE)
    ),
) -> SizeGridRead:
    try:
        return create_size_grid_row(db, grid_id, payload, actor=actor)
    except (SizeGridNotFoundError, SizeGridConflictError) as error:
        raise _http_error(error) from error


@router.patch(
    "/{grid_id}/rows/{row_id}",
    response_model=SizeGridRead,
    operation_id="update_size_grid_row",
)
def patch_row_endpoint(
    grid_id: int,
    row_id: int,
    payload: SizeGridRowUpdate,
    db: Session = Depends(get_db),
    actor: PlatformUser = Depends(
        require_permission(rbac_service.PERM_SIZE_GRIDS_WRITE)
    ),
) -> SizeGridRead:
    try:
        return update_size_grid_row(db, grid_id, row_id, payload, actor=actor)
    except (
        SizeGridNotFoundError,
        SizeGridConflictError,
        SizeGridValidationError,
    ) as error:
        raise _http_error(error) from error


@router.delete(
    "/{grid_id}/rows/{row_id}",
    response_model=SizeGridRead,
    operation_id="delete_size_grid_row",
)
def remove_row_endpoint(
    grid_id: int,
    row_id: int,
    db: Session = Depends(get_db),
    actor: PlatformUser = Depends(
        require_permission(rbac_service.PERM_SIZE_GRIDS_WRITE)
    ),
) -> SizeGridRead:
    try:
        return delete_size_grid_row(db, grid_id, row_id, actor=actor)
    except SizeGridNotFoundError as error:
        raise _http_error(error) from error
