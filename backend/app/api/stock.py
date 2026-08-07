from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.schemas.stock import (
    StockBalanceRead,
    StockDocumentCreate,
    StockDocumentRead,
)
from app.services.stock_balances import (
    StockBalanceNotFoundError,
    StockBalanceValidationError,
    list_stock_balances,
)
from app.services.stock_documents import (
    StockDocumentConflictError,
    StockDocumentNotFoundError,
    StockDocumentValidationError,
    create_stock_document,
    get_stock_document,
    list_stock_documents,
    post_stock_document,
    serialize_stock_document,
    serialize_stock_documents,
)

router = APIRouter(prefix="/stock", tags=["Stock"])


@router.get(
    "/balances",
    response_model=list[StockBalanceRead],
    operation_id="list_stock_balances",
)
def read_stock_balances(
    nomenclature_id: list[int] | None = Query(
        default=None,
        description="Optional filter: only these nomenclature ids",
    ),
    warehouse_id: int | None = Query(
        default=None,
        ge=1,
        description="Optional warehouse scope (`12.1.2`); omit to aggregate",
    ),
    db: Session = Depends(get_db),
) -> list[StockBalanceRead]:
    """Projected balances from posted ledger (`12.2.2`)."""
    try:
        return list_stock_balances(
            db,
            nomenclature_ids=nomenclature_id,
            warehouse_id=warehouse_id,
        )
    except StockBalanceNotFoundError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=str(error)
        ) from error
    except StockBalanceValidationError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(error)
        ) from error


@router.get(
    "/documents",
    response_model=list[StockDocumentRead],
    operation_id="list_stock_documents",
)
def read_stock_documents(
    doc_type: str | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias="status"),
    warehouse_id: int | None = Query(default=None, ge=1),
    technical_card_id: int | None = Query(default=None, ge=1),
    sales_order_id: int | None = Query(default=None, ge=1),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> list[StockDocumentRead]:
    """Stock document journal for `/warehouse/movements` (`12.3.3`)."""
    try:
        rows = list_stock_documents(
            db,
            doc_type=doc_type,
            status=status_filter,
            warehouse_id=warehouse_id,
            technical_card_id=technical_card_id,
            sales_order_id=sales_order_id,
            limit=limit,
            offset=offset,
        )
        return serialize_stock_documents(db, rows)
    except StockDocumentValidationError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(error)
        ) from error


@router.post(
    "/documents",
    response_model=StockDocumentRead,
    status_code=status.HTTP_201_CREATED,
    operation_id="create_stock_document",
)
def create_stock_document_endpoint(
    payload: StockDocumentCreate,
    db: Session = Depends(get_db),
) -> StockDocumentRead:
    try:
        return serialize_stock_document(db, create_stock_document(db, payload))
    except StockDocumentConflictError as error:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail=str(error)
        ) from error
    except StockDocumentValidationError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(error)
        ) from error


@router.get(
    "/documents/{document_id}",
    response_model=StockDocumentRead,
    operation_id="get_stock_document",
)
def read_stock_document(
    document_id: int,
    db: Session = Depends(get_db),
) -> StockDocumentRead:
    try:
        return serialize_stock_document(db, get_stock_document(db, document_id))
    except StockDocumentNotFoundError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=str(error)
        ) from error


@router.post(
    "/documents/{document_id}/post",
    response_model=StockDocumentRead,
    operation_id="post_stock_document",
)
def post_stock_document_endpoint(
    document_id: int,
    db: Session = Depends(get_db),
) -> StockDocumentRead:
    try:
        return serialize_stock_document(db, post_stock_document(db, document_id))
    except StockDocumentNotFoundError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=str(error)
        ) from error
    except StockDocumentConflictError as error:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail=str(error)
        ) from error
    except StockDocumentValidationError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(error)
        ) from error
