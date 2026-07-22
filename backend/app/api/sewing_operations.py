from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.schemas.sewing_operation import (
    SewingOperationCreate,
    SewingOperationRead,
    SewingOperationUpdate,
)
from app.services.sewing_operations import (
    SewingOperationConflictError,
    SewingOperationNotFoundError,
    SewingOperationValidationError,
    create_sewing_operation,
    delete_sewing_operation,
    get_sewing_operation,
    list_sewing_operations,
    update_sewing_operation,
)

router = APIRouter(prefix="/sewing-operations", tags=["Sewing operations"])


@router.get(
    "",
    response_model=list[SewingOperationRead],
    operation_id="list_sewing_operations",
)
def read_sewing_operations(
    search: str | None = Query(default=None, max_length=255),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> list:
    return list_sewing_operations(db, search=search, limit=limit, offset=offset)


@router.post(
    "",
    response_model=SewingOperationRead,
    status_code=status.HTTP_201_CREATED,
    operation_id="create_sewing_operation",
)
def create_sewing_operation_endpoint(
    payload: SewingOperationCreate,
    db: Session = Depends(get_db),
) -> SewingOperationRead:
    try:
        return create_sewing_operation(db, payload)
    except SewingOperationConflictError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error


@router.get(
    "/{operation_id}",
    response_model=SewingOperationRead,
    operation_id="get_sewing_operation",
)
def read_sewing_operation(
    operation_id: int,
    db: Session = Depends(get_db),
) -> SewingOperationRead:
    try:
        return get_sewing_operation(db, operation_id)
    except SewingOperationNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error


@router.patch(
    "/{operation_id}",
    response_model=SewingOperationRead,
    operation_id="update_sewing_operation",
)
def patch_sewing_operation(
    operation_id: int,
    payload: SewingOperationUpdate,
    db: Session = Depends(get_db),
) -> SewingOperationRead:
    try:
        return update_sewing_operation(db, operation_id, payload)
    except SewingOperationNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    except SewingOperationConflictError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error
    except SewingOperationValidationError as error:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(error)) from error


@router.delete(
    "/{operation_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    operation_id="delete_sewing_operation",
)
def remove_sewing_operation(
    operation_id: int,
    db: Session = Depends(get_db),
) -> None:
    try:
        delete_sewing_operation(db, operation_id)
    except SewingOperationNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
