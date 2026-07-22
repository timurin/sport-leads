from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models.product_model import ProductModelSizeType, ProductModelStatus
from app.schemas.product_model import ProductModelCreate, ProductModelRead
from app.services.product_models import (
    ProductModelArticleConflictError,
    ProductModelNotFoundError,
    create_product_model,
    get_product_model,
    list_product_models,
)

router = APIRouter(prefix="/product-models", tags=["Product models"])


@router.get("", response_model=list[ProductModelRead], operation_id="list_product_models")
def read_product_models(
    search: str | None = Query(default=None, max_length=255),
    status_filter: ProductModelStatus | None = Query(default=None, alias="status"),
    size_type: ProductModelSizeType | None = None,
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> list:
    return list_product_models(
        db,
        search=search,
        status=status_filter,
        size_type=size_type,
        limit=limit,
        offset=offset,
    )


@router.get("/{model_id}", response_model=ProductModelRead, operation_id="get_product_model")
def read_one_product_model(model_id: int, db: Session = Depends(get_db)):
    try:
        return get_product_model(db, model_id)
    except ProductModelNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


@router.post(
    "",
    response_model=ProductModelRead,
    status_code=status.HTTP_201_CREATED,
    operation_id="create_product_model",
)
def create_one_product_model(payload: ProductModelCreate, db: Session = Depends(get_db)):
    try:
        return create_product_model(db, payload)
    except ProductModelArticleConflictError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error
