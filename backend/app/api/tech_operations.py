from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database.session import get_db
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
