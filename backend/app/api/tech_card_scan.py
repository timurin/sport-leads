"""Tech-card QR scan HTTP API (ADR-030 / Stage 25)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps_auth import get_current_platform_user
from app.database.session import get_db
from app.models.auth import PlatformUser
from app.schemas.tech_card_scan import TechCardScanCommandRequest, TechCardScanRead
from app.services.tech_card_scan import (
    TechCardScanConflictError,
    TechCardScanError,
    TechCardScanForbiddenError,
    TechCardScanNotFoundError,
    TechCardScanValidationError,
    accept_scan,
    complete_transfer_scan,
    get_scan,
    return_scan,
)

router = APIRouter(prefix="/tech-card-scan", tags=["Tech-card scan"])


def _http_error(error: Exception) -> HTTPException:
    if isinstance(error, TechCardScanNotFoundError):
        return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error))
    if isinstance(error, TechCardScanForbiddenError):
        return HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(error))
    if isinstance(error, TechCardScanConflictError):
        return HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error))
    if isinstance(error, TechCardScanValidationError):
        return HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=str(error)
        )
    return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error))


@router.get(
    "/{token}",
    response_model=TechCardScanRead,
    operation_id="get_tech_card_scan",
)
def get_tech_card_scan(
    token: str,
    db: Session = Depends(get_db),
    user: PlatformUser = Depends(get_current_platform_user),
) -> TechCardScanRead:
    try:
        return get_scan(db, token, user)
    except TechCardScanError as error:
        raise _http_error(error) from error


@router.post(
    "/{token}/accept",
    response_model=TechCardScanRead,
    operation_id="accept_tech_card_scan",
)
def accept_tech_card_scan(
    token: str,
    payload: TechCardScanCommandRequest,
    db: Session = Depends(get_db),
    user: PlatformUser = Depends(get_current_platform_user),
) -> TechCardScanRead:
    try:
        return accept_scan(db, token, user, payload)
    except TechCardScanError as error:
        raise _http_error(error) from error


@router.post(
    "/{token}/complete-transfer",
    response_model=TechCardScanRead,
    operation_id="complete_transfer_tech_card_scan",
)
def complete_transfer_tech_card_scan(
    token: str,
    payload: TechCardScanCommandRequest,
    db: Session = Depends(get_db),
    user: PlatformUser = Depends(get_current_platform_user),
) -> TechCardScanRead:
    try:
        return complete_transfer_scan(db, token, user, payload)
    except TechCardScanError as error:
        raise _http_error(error) from error


@router.post(
    "/{token}/return",
    response_model=TechCardScanRead,
    operation_id="return_tech_card_scan",
)
def return_tech_card_scan(
    token: str,
    payload: TechCardScanCommandRequest,
    db: Session = Depends(get_db),
    user: PlatformUser = Depends(get_current_platform_user),
) -> TechCardScanRead:
    try:
        return return_scan(db, token, user, payload)
    except TechCardScanError as error:
        raise _http_error(error) from error
