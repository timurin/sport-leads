from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.schemas.sales import OrganizationCreate, OrganizationRead, OrganizationUpdate
from app.services.organizations import (
    OrganizationConflictError,
    OrganizationNotFoundError,
    OrganizationValidationError,
    create_organization,
    get_organization,
    list_organizations,
    update_organization,
)


router = APIRouter(prefix="/organizations", tags=["Organizations"])


@router.get("", response_model=list[OrganizationRead], operation_id="list_organizations")
def get_organizations(
    active_only: bool = Query(default=True),
    db: Session = Depends(get_db),
) -> list[OrganizationRead]:
    return list_organizations(db, active_only=active_only)


@router.post(
    "",
    response_model=OrganizationRead,
    status_code=status.HTTP_201_CREATED,
    operation_id="create_organization",
)
def post_organization(
    payload: OrganizationCreate,
    db: Session = Depends(get_db),
) -> OrganizationRead:
    try:
        item = create_organization(db, payload)
    except OrganizationConflictError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error
    db.commit()
    return item


@router.get(
    "/{organization_id}",
    response_model=OrganizationRead,
    operation_id="get_organization",
)
def get_organization_by_id(
    organization_id: int,
    db: Session = Depends(get_db),
) -> OrganizationRead:
    try:
        return get_organization(db, organization_id)
    except OrganizationNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


@router.patch(
    "/{organization_id}",
    response_model=OrganizationRead,
    operation_id="update_organization",
)
def patch_organization(
    organization_id: int,
    payload: OrganizationUpdate,
    db: Session = Depends(get_db),
) -> OrganizationRead:
    try:
        item = update_organization(db, organization_id, payload)
    except OrganizationNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except OrganizationConflictError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error
    except OrganizationValidationError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    db.commit()
    return item
