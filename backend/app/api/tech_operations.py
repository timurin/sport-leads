from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps_auth import get_current_platform_user, require_permission
from app.database.session import get_db
from app.schemas.production_capacity import CapacityResourceDetail, CapacityResourceWrite
from app.services.rbac import PERM_TECHNICAL_CARDS_CREATE
from app.services.production_calendar import CalendarError
from app.schemas.tech_operation import (
    TechOperationCreate,
    TechOperationRead,
    TechOperationUpdate,
)
from app.services.tech_operations import (
    TechOperationConflictError,
    TechOperationNotFoundError,
    TechOperationValidationError,
    create_tech_operation,
    delete_tech_operation,
    get_tech_operation,
    list_tech_operations,
    update_tech_operation,
)

router = APIRouter(prefix="/tech-operations", tags=["Tech operations"])


@router.get("/{operation_id}/capacity-resources", response_model=list[CapacityResourceDetail],
            dependencies=[Depends(get_current_platform_user)], operation_id="tech_operation_capacity_resources")
def read_operation_resources(operation_id: int, db: Session = Depends(get_db)):
    from app.services.capacity_resources import get_resources, operation_resource_keys
    try:
        return get_resources(db, operation_resource_keys(db, operation_id))
    except CalendarError as error:
        raise HTTPException(error.status_code, str(error)) from error


@router.put("/{operation_id}/capacity-resources/{resource_key}", response_model=CapacityResourceDetail,
            dependencies=[Depends(require_permission(PERM_TECHNICAL_CARDS_CREATE))],
            operation_id="tech_operation_capacity_resource_save")
def write_operation_resource(operation_id: int, resource_key: str, payload: CapacityResourceWrite,
                             db: Session = Depends(get_db)):
    from app.services.capacity_resources import operation_resource_keys, save_resource
    try:
        if resource_key not in operation_resource_keys(db, operation_id):
            raise CalendarError("Resource is not linked to this operation", 404)
        return save_resource(db, resource_key, payload)
    except CalendarError as error:
        raise HTTPException(error.status_code, str(error)) from error


@router.get(
    "",
    response_model=list[TechOperationRead],
    operation_id="list_tech_operations",
)
def read_tech_operations(
    search: str | None = Query(default=None, max_length=255),
    active_only: bool = Query(default=False),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> list:
    return list_tech_operations(
        db, search=search, active_only=active_only, limit=limit, offset=offset
    )


@router.post(
    "",
    response_model=TechOperationRead,
    status_code=status.HTTP_201_CREATED,
    operation_id="create_tech_operation",
)
def create_tech_operation_endpoint(
    payload: TechOperationCreate,
    db: Session = Depends(get_db),
) -> TechOperationRead:
    try:
        return create_tech_operation(db, payload)
    except TechOperationConflictError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error
    except TechOperationValidationError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@router.get(
    "/{operation_id}",
    response_model=TechOperationRead,
    operation_id="get_tech_operation",
)
def read_tech_operation(
    operation_id: int,
    db: Session = Depends(get_db),
) -> TechOperationRead:
    try:
        return get_tech_operation(db, operation_id)
    except TechOperationNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error


@router.patch(
    "/{operation_id}",
    response_model=TechOperationRead,
    operation_id="update_tech_operation",
)
def patch_tech_operation(
    operation_id: int,
    payload: TechOperationUpdate,
    db: Session = Depends(get_db),
) -> TechOperationRead:
    try:
        return update_tech_operation(db, operation_id, payload)
    except TechOperationNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    except TechOperationConflictError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error
    except TechOperationValidationError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(error)
        ) from error


@router.delete(
    "/{operation_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    operation_id="delete_tech_operation",
)
def remove_tech_operation(
    operation_id: int,
    db: Session = Depends(get_db),
) -> None:
    try:
        delete_tech_operation(db, operation_id)
    except TechOperationNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    except TechOperationConflictError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error
