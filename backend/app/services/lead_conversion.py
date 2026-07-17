from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import or_, select, update
from sqlalchemy.orm import Session

from app.models.sales import (
    Client,
    Lead,
    LeadContact,
    LeadEvent,
    LeadEventType,
    LeadRejectionReason,
    LeadResult,
    LeadStatus,
    LeadTask,
    LeadTaskStatus,
    SalesOrder,
)
from app.schemas.sales import LeadConvertRequest, LeadRejectRequest


class LeadOperationError(RuntimeError):
    pass


class LeadNotFoundError(LeadOperationError):
    pass


class LeadAlreadyCompletedError(LeadOperationError):
    pass


class RejectionReasonError(LeadOperationError):
    pass


def _locked_active_lead(db: Session, lead_id: int) -> Lead:
    lead = db.scalar(
        select(Lead).where(Lead.id == lead_id).with_for_update()
    )
    if lead is None:
        raise LeadNotFoundError("Lead not found")
    if lead.status == LeadStatus.COMPLETED or lead.result is not None:
        raise LeadAlreadyCompletedError("Lead is already completed")
    return lead


def _find_or_create_client(
    db: Session,
    lead: Lead,
    payload: LeadConvertRequest,
) -> Client:
    primary_contact = db.scalar(
        select(LeadContact).where(
            LeadContact.lead_id == lead.id,
            LeadContact.is_primary.is_(True),
        )
    )
    email = (
        str(payload.email)
        if payload.email is not None
        else primary_contact.email if primary_contact is not None else lead.email
    )
    phone = (
        payload.phone
        if payload.phone is not None
        else primary_contact.phone if primary_contact is not None else lead.phone
    )
    client = None
    matches = []
    if email:
        matches.append(Client.email == email)
    if phone:
        matches.append(Client.phone == phone)
    if matches:
        client = db.scalar(select(Client).where(or_(*matches)).limit(1))
    if client is not None:
        return client

    client = Client(
        company_name=payload.company_name if payload.company_name is not None else lead.company_name,
        contact_name=(
            payload.contact_name
            or (primary_contact.name if primary_contact is not None else lead.contact_name)
        ),
        phone=phone,
        email=email,
        city=payload.city if payload.city is not None else lead.city,
        responsible_id=(
            payload.responsible_id
            if payload.responsible_id is not None
            else lead.responsible_id
        ),
    )
    db.add(client)
    db.flush()
    return client


def convert_lead(
    db: Session,
    lead_id: int,
    payload: LeadConvertRequest,
) -> tuple[Lead, SalesOrder]:
    lead = _locked_active_lead(db, lead_id)
    client = _find_or_create_client(db, lead, payload)
    order = SalesOrder(
        number=f"PENDING-{uuid4().hex}",
        lead_id=lead.id,
        client_id=client.id,
        responsible_id=(
            payload.responsible_id
            if payload.responsible_id is not None
            else lead.responsible_id
        ),
        title=payload.title or lead.need_description or f"Order from lead #{lead.id}",
        description=(
            payload.description
            if payload.description is not None
            else lead.need_description
        ),
        product_category=(
            payload.product_category
            if payload.product_category is not None
            else lead.product_category
        ),
        sport=payload.sport if payload.sport is not None else lead.sport,
        quantity=(
            payload.quantity
            if payload.quantity is not None
            else lead.estimated_quantity
        ),
        amount=payload.amount if payload.amount is not None else lead.estimated_amount,
        desired_date=(
            payload.desired_date
            if payload.desired_date is not None
            else lead.desired_date
        ),
        source=payload.source if payload.source is not None else lead.source,
    )
    db.add(order)
    db.flush()
    order.number = f"SO-{datetime.now(timezone.utc):%Y}-{order.id:06d}"

    completed_at = datetime.now(timezone.utc)
    lead.status = LeadStatus.COMPLETED
    lead.result = LeadResult.CONVERTED
    lead.converted_order_id = order.id
    lead.rejection_reason_id = None
    lead.rejection_comment = None
    lead.completed_at = completed_at
    lead.completed_by_id = payload.completed_by_id
    db.add_all(
        [
            LeadEvent(
                lead_id=lead.id,
                order_id=order.id,
                event_type=LeadEventType.ORDER_CREATED,
                actor_id=payload.completed_by_id,
                message=f"Created order {order.number}",
            ),
            LeadEvent(
                lead_id=lead.id,
                order_id=order.id,
                event_type=LeadEventType.LEAD_CONVERTED,
                actor_id=payload.completed_by_id,
                message=f"Lead converted to order {order.number}",
            ),
        ]
    )
    db.flush()
    return lead, order


def reject_lead(
    db: Session,
    lead_id: int,
    payload: LeadRejectRequest,
) -> Lead:
    lead = _locked_active_lead(db, lead_id)
    reason = db.get(LeadRejectionReason, payload.rejection_reason_id)
    if reason is None:
        raise RejectionReasonError("Rejection reason not found")
    if not reason.is_active:
        raise RejectionReasonError("Rejection reason is inactive")
    if reason.requires_comment and not payload.comment:
        raise RejectionReasonError("A comment is required for this rejection reason")

    completed_at = datetime.now(timezone.utc)
    lead.status = LeadStatus.COMPLETED
    lead.result = LeadResult.REJECTED
    lead.converted_order_id = None
    lead.rejection_reason_id = reason.id
    lead.rejection_comment = payload.comment
    lead.completed_at = completed_at
    lead.completed_by_id = payload.completed_by_id
    db.execute(
        update(LeadTask)
        .where(
            LeadTask.lead_id == lead.id,
            LeadTask.status == LeadTaskStatus.OPEN,
        )
        .values(status=LeadTaskStatus.CANCELLED, completed_at=completed_at)
    )
    db.add(
        LeadEvent(
            lead_id=lead.id,
            event_type=LeadEventType.LEAD_REJECTED,
            actor_id=payload.completed_by_id,
            message=f"Rejected: {reason.name}"
            + (f". {payload.comment}" if payload.comment else ""),
        )
    )
    db.flush()
    return lead
