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
    post_stock_document,
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
        return create_stock_document(db, payload)
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
        return get_stock_document(db, document_id)
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
        return post_stock_document(db, document_id)
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
