from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models.sales import Organization
from app.schemas.sales import OrganizationRead


router = APIRouter(prefix="/organizations", tags=["Organizations"])


@router.get("", response_model=list[OrganizationRead])
def list_organizations(
    active_only: bool = Query(default=True),
    db: Session = Depends(get_db),
) -> list[OrganizationRead]:
    statement = select(Organization).order_by(Organization.name, Organization.id)
    if active_only:
        statement = statement.where(Organization.is_active.is_(True))
    return [OrganizationRead.model_validate(item) for item in db.scalars(statement).all()]
