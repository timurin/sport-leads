from sqlalchemy.orm import Session

from app.models.sales import (
    Lead,
    LeadContact,
    LeadContactChannel,
    LeadEvent,
    LeadEventType,
    LeadStatus,
    SalesUser,
)
from app.schemas.sales import LeadCreate
from app.services.lead_stages import ensure_default_lead_stages


class LeadCreationError(RuntimeError):
    pass


class LeadResponsibleNotFoundError(LeadCreationError):
    pass


def create_lead(db: Session, payload: LeadCreate) -> Lead:
    ensure_default_lead_stages(db)
    if payload.responsible_id is not None:
        responsible = db.get(SalesUser, payload.responsible_id)
        if responsible is None or not responsible.is_active:
            raise LeadResponsibleNotFoundError("Active responsible user not found")

    values = payload.model_dump()
    if values["email"] is not None:
        values["email"] = str(values["email"])

    lead = Lead(status=LeadStatus.NEW.value, **values)
    db.add(lead)
    db.flush()

    contact = LeadContact(
        lead=lead,
        name=lead.contact_name,
        phone=lead.phone,
        email=lead.email,
        preferred_channel=LeadContactChannel.UNSPECIFIED,
        is_primary=True,
    )
    db.add(contact)
    db.add(
        LeadEvent(
            lead_id=lead.id,
            event_type=LeadEventType.LEAD_CREATED,
            message="Lead created",
        )
    )
    db.flush()
    return lead
