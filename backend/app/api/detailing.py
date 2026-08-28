from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.schemas.detailing import (
    DetailingItemCreate,
    DetailingItemRead,
    DetailingItemUpdate,
    DetailingProductTypeEmbed,
)
from app.services.detailing import (
    DetailingConflictError,
    DetailingNotFoundError,
    DetailingValidationError,
    create_detailing_item,
    delete_detailing_item,
    get_detailing_item,
    list_detailing_items,
    update_detailing_item,
)

router = APIRouter(prefix="/detailing-items", tags=["Detailing"])


def _to_read(row) -> DetailingItemRead:
    types = sorted(
        row.applicability_product_types or [],
        key=lambda item: (item.name.lower(), item.id),
    )
    return DetailingItemRead(
        id=row.id,
        name=row.name,
        applicability_product_types=[
            DetailingProductTypeEmbed(id=item.id, name=item.name) for item in types
        ],
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


@router.get(
    "",
    response_model=list[DetailingItemRead],
    operation_id="list_detailing_items",
)
def read_detailing_items(
    search: str | None = Query(default=None, max_length=255),
    product_type_id: int | None = Query(default=None, gt=0),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> list[DetailingItemRead]:
    rows = list_detailing_items(
        db,
        search=search,
        product_type_id=product_type_id,
        limit=limit,
        offset=offset,
    )
    return [_to_read(row) for row in rows]


@router.post(
    "",
    response_model=DetailingItemRead,
    status_code=status.HTTP_201_CREATED,
    operation_id="create_detailing_item",
)
def create_one_detailing_item(
    payload: DetailingItemCreate,
    db: Session = Depends(get_db),
) -> DetailingItemRead:
    try:
        return _to_read(create_detailing_item(db, payload))
    except DetailingValidationError as error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error)) from error
    except DetailingConflictError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error


@router.get(
    "/{item_id}",
    response_model=DetailingItemRead,
    operation_id="get_detailing_item",
)
def read_one_detailing_item(
    item_id: int,
    db: Session = Depends(get_db),
) -> DetailingItemRead:
    try:
        return _to_read(get_detailing_item(db, item_id))
    except DetailingNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error


@router.patch(
    "/{item_id}",
    response_model=DetailingItemRead,
    operation_id="update_detailing_item",
)
def patch_detailing_item(
    item_id: int,
    payload: DetailingItemUpdate,
    db: Session = Depends(get_db),
) -> DetailingItemRead:
    try:
        return _to_read(update_detailing_item(db, item_id, payload))
    except DetailingNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    except DetailingValidationError as error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error)) from error
    except DetailingConflictError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error


@router.delete(
    "/{item_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    operation_id="delete_detailing_item",
)
def remove_detailing_item(
    item_id: int,
    db: Session = Depends(get_db),
) -> Response:
    try:
        delete_detailing_item(db, item_id)
    except DetailingNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    return Response(status_code=status.HTTP_204_NO_CONTENT)
