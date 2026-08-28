from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.schemas.supplier import (
    SupplierCreate,
    SupplierDetailRead,
    SupplierListItem,
    SupplierPriceCreate,
    SupplierPriceRead,
    SupplierPriceUpdate,
    SupplierUpdate,
)
from app.services.suppliers import (
    SupplierConflictError,
    SupplierNotFoundError,
    SupplierValidationError,
    create_supplier,
    create_supplier_price,
    delete_supplier,
    delete_supplier_price,
    get_supplier,
    list_suppliers,
    update_supplier,
    update_supplier_price,
)

router = APIRouter(prefix="/suppliers", tags=["Suppliers"])


def _http_error(error: Exception) -> HTTPException:
    if isinstance(error, SupplierNotFoundError):
        return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error))
    if isinstance(error, SupplierConflictError):
        return HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error))
    if isinstance(error, SupplierValidationError):
        return HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(error)
        )
    raise error


@router.get(
    "",
    response_model=list[SupplierListItem],
    operation_id="list_suppliers",
)
def read_suppliers(
    search: str | None = Query(default=None, max_length=255),
    active_only: bool = Query(default=False),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> list[SupplierListItem]:
    return list_suppliers(
        db,
        search=search,
        active_only=active_only,
        limit=limit,
        offset=offset,
    )


@router.post(
    "",
    response_model=SupplierDetailRead,
    status_code=status.HTTP_201_CREATED,
    operation_id="create_supplier",
)
def create_supplier_endpoint(
    payload: SupplierCreate,
    db: Session = Depends(get_db),
) -> SupplierDetailRead:
    try:
        return create_supplier(db, payload)
    except (SupplierConflictError, SupplierValidationError) as error:
        raise _http_error(error) from error


@router.get(
    "/{supplier_id}",
    response_model=SupplierDetailRead,
    operation_id="get_supplier",
)
def read_supplier(
    supplier_id: int, db: Session = Depends(get_db)
) -> SupplierDetailRead:
    try:
        return get_supplier(db, supplier_id)
    except SupplierNotFoundError as error:
        raise _http_error(error) from error


@router.patch(
    "/{supplier_id}",
    response_model=SupplierDetailRead,
    operation_id="update_supplier",
)
def patch_supplier(
    supplier_id: int,
    payload: SupplierUpdate,
    db: Session = Depends(get_db),
) -> SupplierDetailRead:
    try:
        return update_supplier(db, supplier_id, payload)
    except (
        SupplierNotFoundError,
        SupplierConflictError,
        SupplierValidationError,
    ) as error:
        raise _http_error(error) from error


@router.delete(
    "/{supplier_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    operation_id="delete_supplier",
)
def remove_supplier(supplier_id: int, db: Session = Depends(get_db)) -> None:
    try:
        delete_supplier(db, supplier_id)
    except (SupplierNotFoundError, SupplierValidationError) as error:
        raise _http_error(error) from error


@router.post(
    "/{supplier_id}/prices",
    response_model=SupplierPriceRead,
    status_code=status.HTTP_201_CREATED,
    operation_id="create_supplier_price",
)
def create_price_endpoint(
    supplier_id: int,
    payload: SupplierPriceCreate,
    db: Session = Depends(get_db),
) -> SupplierPriceRead:
    try:
        return create_supplier_price(db, supplier_id, payload)
    except (
        SupplierNotFoundError,
        SupplierConflictError,
        SupplierValidationError,
    ) as error:
        raise _http_error(error) from error


@router.patch(
    "/{supplier_id}/prices/{price_id}",
    response_model=SupplierPriceRead,
    operation_id="update_supplier_price",
)
def patch_price_endpoint(
    supplier_id: int,
    price_id: int,
    payload: SupplierPriceUpdate,
    db: Session = Depends(get_db),
) -> SupplierPriceRead:
    try:
        return update_supplier_price(db, supplier_id, price_id, payload)
    except (
        SupplierNotFoundError,
        SupplierConflictError,
        SupplierValidationError,
    ) as error:
        raise _http_error(error) from error


@router.delete(
    "/{supplier_id}/prices/{price_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    operation_id="delete_supplier_price",
)
def remove_price_endpoint(
    supplier_id: int,
    price_id: int,
    db: Session = Depends(get_db),
) -> None:
    try:
        delete_supplier_price(db, supplier_id, price_id)
    except SupplierNotFoundError as error:
        raise _http_error(error) from error
