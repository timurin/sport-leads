from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models.sales import SalesUser
from app.schemas.sales import SalesUserRead


router = APIRouter(prefix="/sales-users", tags=["Sales users"])


@router.get("", response_model=list[SalesUserRead])
def list_sales_users(
    is_active: bool | None = Query(default=True),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> list[SalesUserRead]:
    statement = select(SalesUser).order_by(SalesUser.name, SalesUser.id)
    if is_active is not None:
        statement = statement.where(SalesUser.is_active.is_(is_active))
    statement = statement.offset(offset).limit(limit)
    return [SalesUserRead.model_validate(item) for item in db.scalars(statement).all()]
