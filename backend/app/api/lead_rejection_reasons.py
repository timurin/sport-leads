from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models.sales import LeadRejectionReason
from app.schemas.sales import (
    LeadRejectionReasonCreate,
    LeadRejectionReasonRead,
    LeadRejectionReasonUpdate,
)


router = APIRouter(prefix="/lead-rejection-reasons", tags=["Lead rejection reasons"])


@router.get("", response_model=list[LeadRejectionReasonRead])
def list_rejection_reasons(
    is_active: bool | None = None,
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
) -> list[LeadRejectionReason]:
    statement = select(LeadRejectionReason)
    if is_active is not None:
        statement = statement.where(LeadRejectionReason.is_active == is_active)
    return list(
        db.scalars(
            statement.order_by(
                LeadRejectionReason.category,
                LeadRejectionReason.sort_order,
                LeadRejectionReason.name,
            ).limit(limit)
        ).all()
    )


@router.post("", response_model=LeadRejectionReasonRead, status_code=201)
def create_rejection_reason(
    payload: LeadRejectionReasonCreate,
    db: Session = Depends(get_db),
) -> LeadRejectionReason:
    reason = LeadRejectionReason(**payload.model_dump())
    db.add(reason)
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(status_code=409, detail="Rejection reason code already exists") from error
    db.refresh(reason)
    return reason


@router.patch("/{reason_id}", response_model=LeadRejectionReasonRead)
def update_rejection_reason(
    reason_id: int,
    payload: LeadRejectionReasonUpdate,
    db: Session = Depends(get_db),
) -> LeadRejectionReason:
    reason = db.get(LeadRejectionReason, reason_id)
    if reason is None:
        raise HTTPException(status_code=404, detail="Rejection reason not found")
    for field_name, value in payload.model_dump(exclude_unset=True).items():
        setattr(reason, field_name, value)
    db.commit()
    db.refresh(reason)
    return reason
