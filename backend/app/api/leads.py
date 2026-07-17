from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models.sales import Lead, LeadEvent, LeadEventType, LeadResult, LeadStatus
from app.schemas.sales import (
    LeadConversionRead,
    LeadContactCreate,
    LeadContactRead,
    LeadContactUpdate,
    LeadConvertRequest,
    LeadEventRead,
    LeadRead,
    LeadRejectRequest,
    LeadUpdate,
)
from app.services.lead_contacts import (
    LeadContactNotFoundError,
    LeadNotFoundError as ContactLeadNotFoundError,
    PrimaryLeadContactDeletionError,
    create_lead_contact,
    delete_lead_contact,
    set_primary_lead_contact,
    update_lead_contact,
)
from app.services.lead_conversion import (
    LeadAlreadyCompletedError,
    LeadNotFoundError,
    RejectionReasonError,
    convert_lead,
    reject_lead,
)


router = APIRouter(prefix="/leads", tags=["Sales leads"])


def _contact_http_error(error: Exception) -> HTTPException:
    if isinstance(error, (ContactLeadNotFoundError, LeadContactNotFoundError)):
        return HTTPException(status_code=404, detail=str(error))
    return HTTPException(status_code=409, detail=str(error))


@router.get("", response_model=list[LeadRead])
def list_leads(
    result: LeadResult | None = None,
    active: bool | None = None,
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> list[Lead]:
    statement = select(Lead)
    if result is not None:
        statement = statement.where(Lead.result == result)
    if active is True:
        statement = statement.where(Lead.status != LeadStatus.COMPLETED)
    elif active is False:
        statement = statement.where(Lead.status == LeadStatus.COMPLETED)
    statement = statement.order_by(Lead.created_at.desc(), Lead.id.desc()).offset(offset).limit(limit)
    return list(db.scalars(statement).all())


@router.get("/{lead_id}", response_model=LeadRead)
def get_lead(lead_id: int, db: Session = Depends(get_db)) -> Lead:
    lead = db.get(Lead, lead_id)
    if lead is None:
        raise HTTPException(status_code=404, detail="Lead not found")
    return lead


@router.patch("/{lead_id}", response_model=LeadRead)
def update_lead(lead_id: int, payload: LeadUpdate, db: Session = Depends(get_db)) -> Lead:
    lead = db.get(Lead, lead_id)
    if lead is None:
        raise HTTPException(status_code=404, detail="Lead not found")
    if lead.status == LeadStatus.COMPLETED:
        raise HTTPException(status_code=409, detail="Completed leads cannot be changed")
    changes = payload.model_dump(exclude_unset=True)
    previous_status = lead.status
    for field_name, value in changes.items():
        setattr(lead, field_name, value)
    if "status" in changes and lead.status != previous_status:
        db.add(
            LeadEvent(
                lead_id=lead.id,
                event_type=LeadEventType.LEAD_STATUS_CHANGED,
                message=f"Status changed from {previous_status.value} to {lead.status.value}",
            )
        )
    db.commit()
    db.refresh(lead)
    return lead


@router.post(
    "/{lead_id}/contacts",
    response_model=LeadContactRead,
    status_code=status.HTTP_201_CREATED,
)
def create_contact_endpoint(
    lead_id: int,
    payload: LeadContactCreate,
    db: Session = Depends(get_db),
) -> LeadContactRead:
    try:
        contact = create_lead_contact(db, lead_id, payload)
        db.commit()
    except (ContactLeadNotFoundError, LeadContactNotFoundError) as error:
        db.rollback()
        raise _contact_http_error(error) from error
    db.refresh(contact)
    return LeadContactRead.model_validate(contact)


@router.patch(
    "/{lead_id}/contacts/{contact_id}",
    response_model=LeadContactRead,
)
def update_contact_endpoint(
    lead_id: int,
    contact_id: int,
    payload: LeadContactUpdate,
    db: Session = Depends(get_db),
) -> LeadContactRead:
    try:
        contact = update_lead_contact(db, lead_id, contact_id, payload)
        db.commit()
    except (ContactLeadNotFoundError, LeadContactNotFoundError) as error:
        db.rollback()
        raise _contact_http_error(error) from error
    db.refresh(contact)
    return LeadContactRead.model_validate(contact)


@router.post(
    "/{lead_id}/contacts/{contact_id}/set-primary",
    response_model=LeadContactRead,
)
def set_primary_contact_endpoint(
    lead_id: int,
    contact_id: int,
    db: Session = Depends(get_db),
) -> LeadContactRead:
    try:
        contact = set_primary_lead_contact(db, lead_id, contact_id)
        db.commit()
    except (ContactLeadNotFoundError, LeadContactNotFoundError) as error:
        db.rollback()
        raise _contact_http_error(error) from error
    db.refresh(contact)
    return LeadContactRead.model_validate(contact)


@router.delete(
    "/{lead_id}/contacts/{contact_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_contact_endpoint(
    lead_id: int,
    contact_id: int,
    db: Session = Depends(get_db),
) -> Response:
    try:
        delete_lead_contact(db, lead_id, contact_id)
        db.commit()
    except (
        ContactLeadNotFoundError,
        LeadContactNotFoundError,
        PrimaryLeadContactDeletionError,
    ) as error:
        db.rollback()
        raise _contact_http_error(error) from error
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{lead_id}/convert", response_model=LeadConversionRead, status_code=201)
def convert_lead_endpoint(
    lead_id: int,
    payload: LeadConvertRequest,
    db: Session = Depends(get_db),
) -> LeadConversionRead:
    try:
        lead, order = convert_lead(db, lead_id, payload)
        db.commit()
    except LeadNotFoundError as error:
        db.rollback()
        raise HTTPException(status_code=404, detail=str(error)) from error
    except LeadAlreadyCompletedError as error:
        db.rollback()
        raise HTTPException(status_code=409, detail=str(error)) from error
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(status_code=409, detail="Lead conversion conflict") from error
    db.refresh(lead)
    db.refresh(order)
    return LeadConversionRead(lead=LeadRead.model_validate(lead), order=order)


@router.post("/{lead_id}/reject", response_model=LeadRead)
def reject_lead_endpoint(
    lead_id: int,
    payload: LeadRejectRequest,
    db: Session = Depends(get_db),
) -> Lead:
    try:
        lead = reject_lead(db, lead_id, payload)
        db.commit()
    except LeadNotFoundError as error:
        db.rollback()
        raise HTTPException(status_code=404, detail=str(error)) from error
    except (LeadAlreadyCompletedError, RejectionReasonError) as error:
        db.rollback()
        raise HTTPException(status_code=409, detail=str(error)) from error
    db.refresh(lead)
    return lead


@router.get("/{lead_id}/history", response_model=list[LeadEventRead])
def get_lead_history(lead_id: int, db: Session = Depends(get_db)) -> list[LeadEvent]:
    if db.get(Lead, lead_id) is None:
        raise HTTPException(status_code=404, detail="Lead not found")
    return list(
        db.scalars(
            select(LeadEvent)
            .where(LeadEvent.lead_id == lead_id)
            .order_by(LeadEvent.created_at, LeadEvent.id)
        ).all()
    )
