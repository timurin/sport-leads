from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.models.sales import Lead, LeadContact
from app.schemas.sales import LeadContactCreate, LeadContactUpdate


class LeadContactOperationError(RuntimeError):
    pass


class LeadNotFoundError(LeadContactOperationError):
    pass


class LeadContactNotFoundError(LeadContactOperationError):
    pass


class PrimaryLeadContactDeletionError(LeadContactOperationError):
    pass


def _locked_lead(db: Session, lead_id: int) -> Lead:
    lead = db.scalar(select(Lead).where(Lead.id == lead_id).with_for_update())
    if lead is None:
        raise LeadNotFoundError("Lead not found")
    return lead


def _locked_contact(db: Session, lead_id: int, contact_id: int) -> LeadContact:
    contact = db.scalar(
        select(LeadContact)
        .where(LeadContact.id == contact_id, LeadContact.lead_id == lead_id)
        .with_for_update()
    )
    if contact is None:
        raise LeadContactNotFoundError("Lead contact not found")
    return contact


def _sync_primary_projection(lead: Lead, contact: LeadContact) -> None:
    lead.contact_name = contact.name
    lead.phone = contact.phone
    lead.email = contact.email


def _unset_primary(db: Session, lead_id: int) -> None:
    db.execute(
        update(LeadContact)
        .where(LeadContact.lead_id == lead_id, LeadContact.is_primary.is_(True))
        .values(is_primary=False)
    )


def create_lead_contact(
    db: Session,
    lead_id: int,
    payload: LeadContactCreate,
) -> LeadContact:
    lead = _locked_lead(db, lead_id)
    contact_count = db.scalar(
        select(func.count()).select_from(LeadContact).where(LeadContact.lead_id == lead_id)
    )
    make_primary = payload.is_primary or contact_count == 0
    if make_primary:
        _unset_primary(db, lead_id)
    contact = LeadContact(
        lead_id=lead_id,
        name=payload.name,
        position=payload.position,
        phone=payload.phone,
        email=str(payload.email) if payload.email is not None else None,
        preferred_channel=payload.preferred_channel,
        is_primary=make_primary,
    )
    db.add(contact)
    db.flush()
    if make_primary:
        _sync_primary_projection(lead, contact)
        db.flush()
    return contact


def update_lead_contact(
    db: Session,
    lead_id: int,
    contact_id: int,
    payload: LeadContactUpdate,
) -> LeadContact:
    lead = _locked_lead(db, lead_id)
    contact = _locked_contact(db, lead_id, contact_id)
    for field_name, value in payload.model_dump(exclude_unset=True).items():
        if field_name == "email" and value is not None:
            value = str(value)
        setattr(contact, field_name, value)
    db.flush()
    if contact.is_primary:
        _sync_primary_projection(lead, contact)
        db.flush()
    return contact


def set_primary_lead_contact(db: Session, lead_id: int, contact_id: int) -> LeadContact:
    lead = _locked_lead(db, lead_id)
    contact = _locked_contact(db, lead_id, contact_id)
    _unset_primary(db, lead_id)
    contact.is_primary = True
    _sync_primary_projection(lead, contact)
    db.flush()
    return contact


def delete_lead_contact(db: Session, lead_id: int, contact_id: int) -> None:
    _locked_lead(db, lead_id)
    contact = _locked_contact(db, lead_id, contact_id)
    if contact.is_primary:
        raise PrimaryLeadContactDeletionError("Primary lead contact cannot be deleted")
    db.delete(contact)
    db.flush()
