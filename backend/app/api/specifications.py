"""Specification document API (ADR-031 / Stage 7.2.1)."""

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models.specification import Specification
from app.schemas.specification import (
    SpecificationCreate,
    SpecificationListItem,
    SpecificationRead,
)
from app.services.specifications import (
    SpecificationConflictError,
    SpecificationNotFoundError,
    SpecificationValidationError,
    approve_specification,
    cancel_specification_draft,
    create_next_draft,
    create_specification,
    get_specification,
    list_specifications,
    refresh_specification_draft,
)

router = APIRouter(prefix="/specifications", tags=["Specifications"])


def _http_error(error: Exception) -> HTTPException:
    if isinstance(error, SpecificationNotFoundError):
        return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error))
    if isinstance(error, SpecificationConflictError):
        return HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error))
    if isinstance(error, SpecificationValidationError):
        return HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(error)
        )
    return HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(error)
    )


@router.get(
    "",
    response_model=list[SpecificationListItem],
    operation_id="list_specifications",
)
def read_specifications(
    production_batch_id: int | None = Query(default=None, gt=0),
    production_order_id: int | None = Query(default=None, gt=0),
    sales_order_id: int | None = Query(default=None, gt=0),
    status_filter: str | None = Query(default=None, alias="status", max_length=20),
    search: str | None = Query(default=None, alias="q", max_length=255),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> list[SpecificationListItem]:
    return list_specifications(
        db,
        production_batch_id=production_batch_id,
        production_order_id=production_order_id,
        sales_order_id=sales_order_id,
        status=status_filter,
        search=search,
        limit=limit,
        offset=offset,
    )


@router.post(
    "",
    response_model=SpecificationRead,
    operation_id="create_specification",
)
def create_specification_endpoint(
    payload: SpecificationCreate,
    response: Response,
    db: Session = Depends(get_db),
) -> SpecificationRead:
    existing_id = db.scalar(
        select(Specification.id).where(
            Specification.production_batch_id == payload.production_batch_id
        )
    )
    try:
        body = create_specification(db, payload.production_batch_id)
    except (
        SpecificationNotFoundError,
        SpecificationConflictError,
        SpecificationValidationError,
    ) as error:
        raise _http_error(error) from error
    response.status_code = (
        status.HTTP_201_CREATED if existing_id is None else status.HTTP_200_OK
    )
    return body


@router.get(
    "/{specification_id}",
    response_model=SpecificationRead,
    operation_id="get_specification",
)
def read_specification(
    specification_id: int,
    db: Session = Depends(get_db),
) -> SpecificationRead:
    try:
        return get_specification(db, specification_id)
    except SpecificationNotFoundError as error:
        raise _http_error(error) from error


@router.post(
    "/{specification_id}/refresh",
    response_model=SpecificationRead,
    operation_id="refresh_specification_draft",
)
def refresh_specification_endpoint(
    specification_id: int,
    db: Session = Depends(get_db),
) -> SpecificationRead:
    try:
        return refresh_specification_draft(db, specification_id)
    except (
        SpecificationNotFoundError,
        SpecificationConflictError,
        SpecificationValidationError,
    ) as error:
        raise _http_error(error) from error


@router.post(
    "/{specification_id}/new-draft",
    response_model=SpecificationRead,
    operation_id="create_specification_next_draft",
)
def create_next_draft_endpoint(
    specification_id: int,
    db: Session = Depends(get_db),
) -> SpecificationRead:
    try:
        return create_next_draft(db, specification_id)
    except (
        SpecificationNotFoundError,
        SpecificationConflictError,
        SpecificationValidationError,
    ) as error:
        raise _http_error(error) from error


@router.post(
    "/{specification_id}/approve",
    response_model=SpecificationRead,
    operation_id="approve_specification",
)
def approve_specification_endpoint(
    specification_id: int,
    db: Session = Depends(get_db),
) -> SpecificationRead:
    try:
        return approve_specification(db, specification_id)
    except (
        SpecificationNotFoundError,
        SpecificationConflictError,
        SpecificationValidationError,
    ) as error:
        raise _http_error(error) from error


@router.post(
    "/{specification_id}/cancel-draft",
    response_model=SpecificationRead,
    operation_id="cancel_specification_draft",
)
def cancel_specification_draft_endpoint(
    specification_id: int,
    db: Session = Depends(get_db),
) -> SpecificationRead:
    try:
        return cancel_specification_draft(db, specification_id)
    except (
        SpecificationNotFoundError,
        SpecificationConflictError,
        SpecificationValidationError,
    ) as error:
        raise _http_error(error) from error
