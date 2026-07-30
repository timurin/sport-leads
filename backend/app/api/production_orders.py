"""Production orders / batches API (Stage 11.1.1.3 / ADR-018)."""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.schemas.production_order import (
    ProductionBatchAttachCardRequest,
    ProductionBatchCreate,
    ProductionBatchRead,
    ProductionFactRollupRead,
    ProductionOrderCreate,
    ProductionOrderListItem,
    ProductionOrderRead,
)
from app.services.production_fact_rollup import (
    get_production_batch_fact_rollup,
    get_production_order_fact_rollup,
)
from app.services.production_orders import (
    ProductionBatchNotFoundError,
    ProductionOrderConflictError,
    ProductionOrderNotFoundError,
    ProductionOrderValidationError,
    attach_technical_card_to_batch,
    create_production_batch,
    create_production_order,
    detach_technical_card_from_batch,
    get_production_order,
    list_production_orders,
)

router = APIRouter(prefix="/production-orders", tags=["Production orders"])
batches_router = APIRouter(prefix="/production-batches", tags=["Production batches"])


def _http_error(error: Exception) -> HTTPException:
    if isinstance(error, (ProductionOrderNotFoundError, ProductionBatchNotFoundError)):
        return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error))
    if isinstance(error, ProductionOrderConflictError):
        return HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error))
    if isinstance(error, ProductionOrderValidationError):
        return HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(error)
        )
    return HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(error))


@router.get(
    "",
    response_model=list[ProductionOrderListItem],
    operation_id="list_production_orders",
)
def read_production_orders(
    sales_order_id: int | None = Query(default=None, gt=0),
    status_filter: str | None = Query(default=None, alias="status", max_length=20),
    search: str | None = Query(default=None, max_length=255),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> list[ProductionOrderListItem]:
    return list_production_orders(
        db,
        sales_order_id=sales_order_id,
        status=status_filter,
        search=search,
        limit=limit,
        offset=offset,
    )


@router.post(
    "",
    response_model=ProductionOrderRead,
    status_code=status.HTTP_201_CREATED,
    operation_id="create_production_order",
)
def create_production_order_endpoint(
    payload: ProductionOrderCreate,
    db: Session = Depends(get_db),
) -> ProductionOrderRead:
    try:
        return create_production_order(db, payload)
    except (
        ProductionOrderNotFoundError,
        ProductionOrderConflictError,
        ProductionOrderValidationError,
    ) as error:
        raise _http_error(error) from error


@router.get(
    "/{order_id}",
    response_model=ProductionOrderRead,
    operation_id="get_production_order",
)
def read_production_order(
    order_id: int,
    db: Session = Depends(get_db),
) -> ProductionOrderRead:
    try:
        return get_production_order(db, order_id)
    except ProductionOrderNotFoundError as error:
        raise _http_error(error) from error


@router.get(
    "/{order_id}/fact-rollup",
    response_model=ProductionFactRollupRead,
    operation_id="get_production_order_fact_rollup",
)
def read_production_order_fact_rollup(
    order_id: int,
    db: Session = Depends(get_db),
) -> ProductionFactRollupRead:
    try:
        return get_production_order_fact_rollup(db, order_id)
    except ProductionOrderNotFoundError as error:
        raise _http_error(error) from error


@router.post(
    "/{order_id}/batches",
    response_model=ProductionBatchRead,
    status_code=status.HTTP_201_CREATED,
    operation_id="create_production_batch",
)
def create_production_batch_endpoint(
    order_id: int,
    payload: ProductionBatchCreate,
    db: Session = Depends(get_db),
) -> ProductionBatchRead:
    try:
        return create_production_batch(db, order_id, payload)
    except (
        ProductionOrderNotFoundError,
        ProductionOrderConflictError,
        ProductionOrderValidationError,
    ) as error:
        raise _http_error(error) from error


@batches_router.get(
    "/{batch_id}/fact-rollup",
    response_model=ProductionFactRollupRead,
    operation_id="get_production_batch_fact_rollup",
)
def read_production_batch_fact_rollup(
    batch_id: int,
    db: Session = Depends(get_db),
) -> ProductionFactRollupRead:
    try:
        return get_production_batch_fact_rollup(db, batch_id)
    except ProductionBatchNotFoundError as error:
        raise _http_error(error) from error


@batches_router.post(
    "/{batch_id}/cards",
    response_model=ProductionBatchRead,
    operation_id="attach_technical_card_to_production_batch",
)
def attach_card_endpoint(
    batch_id: int,
    payload: ProductionBatchAttachCardRequest,
    db: Session = Depends(get_db),
) -> ProductionBatchRead:
    try:
        return attach_technical_card_to_batch(db, batch_id, payload)
    except (
        ProductionBatchNotFoundError,
        ProductionOrderNotFoundError,
        ProductionOrderConflictError,
        ProductionOrderValidationError,
    ) as error:
        raise _http_error(error) from error


@batches_router.delete(
    "/{batch_id}/cards/{technical_card_id}",
    response_model=ProductionBatchRead,
    operation_id="detach_technical_card_from_production_batch",
)
def detach_card_endpoint(
    batch_id: int,
    technical_card_id: int,
    db: Session = Depends(get_db),
) -> ProductionBatchRead:
    try:
        return detach_technical_card_from_batch(db, batch_id, technical_card_id)
    except (
        ProductionBatchNotFoundError,
        ProductionOrderValidationError,
    ) as error:
        raise _http_error(error) from error
