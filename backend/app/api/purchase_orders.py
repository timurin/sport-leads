"""Purchase orders API (Stage 13.1.2 / ADR-034)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.schemas.purchase_order import (
    PurchaseOrderCreate,
    PurchaseOrderDetailRead,
    PurchaseOrderLineCreate,
    PurchaseOrderLineUpdate,
    PurchaseOrderListItem,
    PurchaseOrderUpdate,
)
from app.services.purchase_orders import (
    PurchaseOrderConflictError,
    PurchaseOrderNotFoundError,
    PurchaseOrderValidationError,
    cancel_purchase_order,
    confirm_purchase_order,
    create_purchase_order,
    create_purchase_order_line,
    delete_purchase_order_line,
    get_purchase_order,
    list_purchase_orders,
    update_purchase_order,
    update_purchase_order_line,
)

router = APIRouter(prefix="/purchase-orders", tags=["Purchase orders"])


def _http_error(error: Exception) -> HTTPException:
    if isinstance(error, PurchaseOrderNotFoundError):
        return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error))
    if isinstance(error, PurchaseOrderConflictError):
        return HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error))
    if isinstance(error, PurchaseOrderValidationError):
        return HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(error)
        )
    raise error


@router.get(
    "",
    response_model=list[PurchaseOrderListItem],
    operation_id="list_purchase_orders",
)
def read_purchase_orders(
    search: str | None = Query(default=None, max_length=255),
    status_filter: str | None = Query(default=None, alias="status", max_length=20),
    supplier_id: int | None = Query(default=None, ge=1),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> list[PurchaseOrderListItem]:
    return list_purchase_orders(
        db,
        search=search,
        status=status_filter,
        supplier_id=supplier_id,
        limit=limit,
        offset=offset,
    )


@router.post(
    "",
    response_model=PurchaseOrderDetailRead,
    status_code=status.HTTP_201_CREATED,
    operation_id="create_purchase_order",
)
def post_purchase_order(
    payload: PurchaseOrderCreate,
    db: Session = Depends(get_db),
) -> PurchaseOrderDetailRead:
    try:
        return create_purchase_order(db, payload)
    except (
        PurchaseOrderNotFoundError,
        PurchaseOrderConflictError,
        PurchaseOrderValidationError,
    ) as error:
        raise _http_error(error) from error


@router.get(
    "/{order_id}",
    response_model=PurchaseOrderDetailRead,
    operation_id="get_purchase_order",
)
def read_purchase_order(
    order_id: int,
    db: Session = Depends(get_db),
) -> PurchaseOrderDetailRead:
    try:
        return get_purchase_order(db, order_id)
    except PurchaseOrderNotFoundError as error:
        raise _http_error(error) from error


@router.patch(
    "/{order_id}",
    response_model=PurchaseOrderDetailRead,
    operation_id="update_purchase_order",
)
def patch_purchase_order(
    order_id: int,
    payload: PurchaseOrderUpdate,
    db: Session = Depends(get_db),
) -> PurchaseOrderDetailRead:
    try:
        return update_purchase_order(db, order_id, payload)
    except (
        PurchaseOrderNotFoundError,
        PurchaseOrderConflictError,
        PurchaseOrderValidationError,
    ) as error:
        raise _http_error(error) from error


@router.post(
    "/{order_id}/confirm",
    response_model=PurchaseOrderDetailRead,
    operation_id="confirm_purchase_order",
)
def post_confirm_purchase_order(
    order_id: int,
    db: Session = Depends(get_db),
) -> PurchaseOrderDetailRead:
    try:
        return confirm_purchase_order(db, order_id)
    except (
        PurchaseOrderNotFoundError,
        PurchaseOrderValidationError,
    ) as error:
        raise _http_error(error) from error


@router.post(
    "/{order_id}/cancel",
    response_model=PurchaseOrderDetailRead,
    operation_id="cancel_purchase_order",
)
def post_cancel_purchase_order(
    order_id: int,
    db: Session = Depends(get_db),
) -> PurchaseOrderDetailRead:
    try:
        return cancel_purchase_order(db, order_id)
    except (
        PurchaseOrderNotFoundError,
        PurchaseOrderValidationError,
    ) as error:
        raise _http_error(error) from error


@router.post(
    "/{order_id}/lines",
    response_model=PurchaseOrderDetailRead,
    status_code=status.HTTP_201_CREATED,
    operation_id="create_purchase_order_line",
)
def post_purchase_order_line(
    order_id: int,
    payload: PurchaseOrderLineCreate,
    db: Session = Depends(get_db),
) -> PurchaseOrderDetailRead:
    try:
        return create_purchase_order_line(db, order_id, payload)
    except (
        PurchaseOrderNotFoundError,
        PurchaseOrderConflictError,
        PurchaseOrderValidationError,
    ) as error:
        raise _http_error(error) from error


@router.patch(
    "/{order_id}/lines/{line_id}",
    response_model=PurchaseOrderDetailRead,
    operation_id="update_purchase_order_line",
)
def patch_purchase_order_line(
    order_id: int,
    line_id: int,
    payload: PurchaseOrderLineUpdate,
    db: Session = Depends(get_db),
) -> PurchaseOrderDetailRead:
    try:
        return update_purchase_order_line(db, order_id, line_id, payload)
    except (
        PurchaseOrderNotFoundError,
        PurchaseOrderConflictError,
        PurchaseOrderValidationError,
    ) as error:
        raise _http_error(error) from error


@router.delete(
    "/{order_id}/lines/{line_id}",
    response_model=PurchaseOrderDetailRead,
    operation_id="delete_purchase_order_line",
)
def remove_purchase_order_line(
    order_id: int,
    line_id: int,
    db: Session = Depends(get_db),
) -> PurchaseOrderDetailRead:
    try:
        return delete_purchase_order_line(db, order_id, line_id)
    except (
        PurchaseOrderNotFoundError,
        PurchaseOrderConflictError,
        PurchaseOrderValidationError,
    ) as error:
        raise _http_error(error) from error
