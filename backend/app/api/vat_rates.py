from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.schemas.vat_rate import VatRateCreate, VatRateRead, VatRateUpdate
from app.services.vat_rates import (
    VatRateConflictError,
    VatRateNotFoundError,
    VatRateValidationError,
    create_vat_rate,
    delete_vat_rate,
    get_vat_rate,
    list_vat_rates,
    update_vat_rate,
)

router = APIRouter(prefix="/vat-rates", tags=["VAT rates"])


@router.get(
    "",
    response_model=list[VatRateRead],
    operation_id="list_vat_rates",
)
def read_vat_rates(
    is_active: bool | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> list:
    return list_vat_rates(db, is_active=is_active, limit=limit, offset=offset)


@router.post(
    "",
    response_model=VatRateRead,
    status_code=status.HTTP_201_CREATED,
    operation_id="create_vat_rate",
)
def create_vat_rate_endpoint(
    payload: VatRateCreate,
    db: Session = Depends(get_db),
) -> VatRateRead:
    try:
        return create_vat_rate(db, payload)
    except VatRateConflictError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error


@router.get(
    "/{vat_rate_id}",
    response_model=VatRateRead,
    operation_id="get_vat_rate",
)
def read_vat_rate(vat_rate_id: int, db: Session = Depends(get_db)) -> VatRateRead:
    try:
        return get_vat_rate(db, vat_rate_id)
    except VatRateNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error


@router.patch(
    "/{vat_rate_id}",
    response_model=VatRateRead,
    operation_id="update_vat_rate",
)
def patch_vat_rate(
    vat_rate_id: int,
    payload: VatRateUpdate,
    db: Session = Depends(get_db),
) -> VatRateRead:
    try:
        return update_vat_rate(db, vat_rate_id, payload)
    except VatRateNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    except VatRateConflictError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error
    except VatRateValidationError as error:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(error)) from error


@router.delete(
    "/{vat_rate_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    operation_id="delete_vat_rate",
)
def remove_vat_rate(vat_rate_id: int, db: Session = Depends(get_db)) -> None:
    try:
        delete_vat_rate(db, vat_rate_id)
    except VatRateNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
