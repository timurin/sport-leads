from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.schemas.product_type import ProductTypeCreate, ProductTypeRead, ProductTypeUpdate
from app.services.product_types import (
    ProductTypeConflictError,
    ProductTypeNotFoundError,
    create_product_type,
    delete_product_type,
    get_product_type,
    list_product_types,
    update_product_type,
)

router = APIRouter(prefix="/product-types", tags=["Product types"])


@router.get(
    "",
    response_model=list[ProductTypeRead],
    operation_id="list_product_types",
)
def read_product_types(
    search: str | None = Query(default=None, max_length=255),
    is_active: bool | None = None,
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> list[ProductTypeRead]:
    rows = list_product_types(
        db,
        search=search,
        is_active=is_active,
        limit=limit,
        offset=offset,
    )
    return [ProductTypeRead.model_validate(row) for row in rows]


@router.post(
    "",
    response_model=ProductTypeRead,
    status_code=status.HTTP_201_CREATED,
    operation_id="create_product_type",
)
def create_one_product_type(
    payload: ProductTypeCreate,
    db: Session = Depends(get_db),
) -> ProductTypeRead:
    try:
        return ProductTypeRead.model_validate(create_product_type(db, payload))
    except ProductTypeConflictError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error


@router.get(
    "/{product_type_id}",
    response_model=ProductTypeRead,
    operation_id="get_product_type",
)
def read_one_product_type(
    product_type_id: int,
    db: Session = Depends(get_db),
) -> ProductTypeRead:
    try:
        return ProductTypeRead.model_validate(get_product_type(db, product_type_id))
    except ProductTypeNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error


@router.patch(
    "/{product_type_id}",
    response_model=ProductTypeRead,
    operation_id="update_product_type",
)
def patch_product_type(
    product_type_id: int,
    payload: ProductTypeUpdate,
    db: Session = Depends(get_db),
) -> ProductTypeRead:
    try:
        return ProductTypeRead.model_validate(
            update_product_type(db, product_type_id, payload)
        )
    except ProductTypeNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    except ProductTypeConflictError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error


@router.delete(
    "/{product_type_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    operation_id="delete_product_type",
)
def remove_product_type(
    product_type_id: int,
    db: Session = Depends(get_db),
) -> Response:
    try:
        delete_product_type(db, product_type_id)
    except ProductTypeNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    return Response(status_code=status.HTTP_204_NO_CONTENT)
