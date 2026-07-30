from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.schemas.warehouse import WarehouseCreate, WarehouseRead, WarehouseUpdate
from app.services.warehouses import (
    WarehouseConflictError,
    WarehouseNotFoundError,
    WarehouseValidationError,
    create_warehouse,
    delete_warehouse,
    get_warehouse,
    list_warehouses,
    update_warehouse,
)

router = APIRouter(prefix="/warehouses", tags=["Warehouses"])


@router.get(
    "",
    response_model=list[WarehouseRead],
    operation_id="list_warehouses",
)
def read_warehouses(
    search: str | None = Query(default=None, max_length=255),
    active_only: bool = Query(default=False),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> list:
    return list_warehouses(
        db,
        search=search,
        active_only=active_only,
        limit=limit,
        offset=offset,
    )


@router.post(
    "",
    response_model=WarehouseRead,
    status_code=status.HTTP_201_CREATED,
    operation_id="create_warehouse",
)
def create_warehouse_endpoint(
    payload: WarehouseCreate,
    db: Session = Depends(get_db),
) -> WarehouseRead:
    try:
        return create_warehouse(db, payload)
    except WarehouseConflictError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error
    except WarehouseValidationError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(error)
        ) from error


@router.get(
    "/{warehouse_id}",
    response_model=WarehouseRead,
    operation_id="get_warehouse",
)
def read_warehouse(warehouse_id: int, db: Session = Depends(get_db)) -> WarehouseRead:
    try:
        return get_warehouse(db, warehouse_id)
    except WarehouseNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error


@router.patch(
    "/{warehouse_id}",
    response_model=WarehouseRead,
    operation_id="update_warehouse",
)
def patch_warehouse(
    warehouse_id: int,
    payload: WarehouseUpdate,
    db: Session = Depends(get_db),
) -> WarehouseRead:
    try:
        return update_warehouse(db, warehouse_id, payload)
    except WarehouseNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    except WarehouseConflictError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error
    except WarehouseValidationError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(error)
        ) from error


@router.delete(
    "/{warehouse_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    operation_id="delete_warehouse",
)
def remove_warehouse(warehouse_id: int, db: Session = Depends(get_db)) -> None:
    try:
        delete_warehouse(db, warehouse_id)
    except WarehouseNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    except WarehouseValidationError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(error)
        ) from error
